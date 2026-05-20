import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, RotateCcw, MessageSquare, ListChecks, 
  Send, Link, ExternalLink, QrCode, AlertTriangle, 
  User as UserIcon, CheckCircle2, History, X, Trash2, Info, Loader2
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const COLLECTION_NAME = "whatsapp_configs";

interface WaConfig {
  businessNumber: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
}

interface Message {
  direction: 'in' | 'out';
  id: string;
  body: string;
  type: string;
  at: string;
}

interface Contact {
  waId: string;
  name: string;
  connected: boolean;
  appUserId: string | null;
  scope: string | null;
  linkedAt: string | null;
  messages: Message[];
}

interface Permissions {
  searchContacts: boolean;
  sendMessages: boolean;
  readMessages: boolean;
  manageContacts: boolean;
  automaticSender: boolean;
}

interface State {
  config: WaConfig;
  pendingLinks: Record<string, any>;
  contacts: Record<string, Contact>;
  selectedWaId: string | null;
  permissions?: Permissions;
}

export function WhatsAppCloudConnector() {
  const [state, setState] = useState<State>({
    config: {
      businessNumber: "15556375610",
      phoneNumberId: "1148407841689522",
      wabaId: "1308236421503956",
      accessToken: "",
    },
    pendingLinks: {},
    contacts: {},
    selectedWaId: null,
    permissions: {
      searchContacts: false,
      sendMessages: true,
      readMessages: true,
      manageContacts: false,
      automaticSender: false,
    }
  });

  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [waLink, setWaLink] = useState<string>('');
  const [payloadInput, setPayloadInput] = useState<string>('');
  const [sendBody, setSendBody] = useState<string>('✅ Connected. Your WhatsApp is now linked to the AI test connector.');
  const [status, setStatus] = useState({
    config: 'Config not saved yet.',
    qr: 'Ready to connect.',
    payload: 'Waiting for webhook payload.',
    send: 'Select a connected contact first.'
  });

  const [appUserId, setAppUserId] = useState('');
  const [scope, setScope] = useState('receive_and_send');

  // Load state from Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setAppUserId(user.displayName || user.uid);

    const docRef = doc(db, COLLECTION_NAME, user.uid);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as State;
        setState(prev => ({
          ...prev,
          ...data,
          config: { ...prev.config, ...data.config },
          permissions: data.permissions || prev.permissions
        }));
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading WhatsApp config:", error);
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const persistState = async (newState: State) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await setDoc(doc(db, COLLECTION_NAME, user.uid), newState);
    } catch (error) {
      console.error("Error saving WhatsApp config:", error);
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  };

  const saveConfig = async () => {
    setStatus(s => ({ ...s, config: 'Saving to your account...' }));
    await persistState(state);
    setStatus(s => ({ ...s, config: 'Saved successfully to your account.' }));
  };

  const togglePermission = async (key: keyof Permissions) => {
    if (!state.permissions) return;
    const newPermissions = {
      ...state.permissions,
      [key]: !state.permissions[key]
    };
    const newState = { ...state, permissions: newPermissions };
    setState(newState);
    await persistState(newState);
  };

  const resetAll = async () => {
    if (!window.confirm("Clear all your WhatsApp contacts, messages, and saved token from the database?")) return;
    
    const user = auth.currentUser;
    if (!user) return;

    const clearedState: State = {
      config: {
        businessNumber: "",
        phoneNumberId: "",
        wabaId: "",
        accessToken: "",
      },
      pendingLinks: {},
      contacts: {},
      selectedWaId: null,
      permissions: {
        searchContacts: false,
        sendMessages: false,
        readMessages: false,
        manageContacts: false,
        automaticSender: false,
      }
    };

    try {
      await setDoc(doc(db, COLLECTION_NAME, user.uid), clearedState);
      setState(clearedState);
      setQrUrl('');
      setWaLink('');
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
    }
  };

  const generateQr = async () => {
    const businessNumber = state.config.businessNumber.replace(/\D/g, "");
    if (!businessNumber) {
      alert("Business phone number is required.");
      return;
    }
    if (!appUserId) {
      alert("App user ID is required.");
      return;
    }

    const linkCode = `LINK_${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
    const newPendingLinks = {
      ...state.pendingLinks,
      [linkCode]: {
        appUserId,
        scope,
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 10 * 60 * 1000,
      }
    };

    const link = `https://wa.me/${businessNumber}?text=${encodeURIComponent(linkCode)}`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;

    setQrUrl(qr);
    setWaLink(link);
    const newState = { ...state, pendingLinks: newPendingLinks };
    setState(newState);
    await persistState(newState);
    
    setStatus(s => ({ ...s, qr: `QR generated. Send this code from WhatsApp:\n${linkCode}\n\nLinked app user: ${appUserId}\nScope: ${scope}` }));
  };

  const processPayload = async () => {
    if (!payloadInput.trim()) {
      alert("Paste a webhook JSON payload first.");
      return;
    }

    try {
      const payload = JSON.parse(payloadInput);
      const messages: any[] = [];
      const entries = payload?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          const contacts = value?.contacts || [];
          const incoming = value?.messages || [];

          for (const msg of incoming) {
            const waId = msg.from;
            const profile = contacts.find((c: any) => c.wa_id === waId)?.profile || {};
            messages.push({
              waId,
              name: profile.name || waId,
              messageId: msg.id,
              timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now(),
              type: msg.type || "unknown",
              body: msg.text?.body || `[${msg.type || "non-text"} message]`,
              raw: msg,
            });
          }
        }
      }

      if (!messages.length) {
        setStatus(s => ({ ...s, payload: 'No incoming messages found. This may be a status update.' }));
        return;
      }

      let linkedCount = 0;
      let msgCount = 0;
      const newContacts = { ...state.contacts };
      const newPendingLinks = { ...state.pendingLinks };
      let lastWaId = state.selectedWaId;

      for (const msg of messages) {
        const existing = newContacts[msg.waId] || {
          waId: msg.waId,
          name: msg.name,
          connected: false,
          appUserId: null,
          scope: null,
          linkedAt: null,
          messages: [],
        };

        existing.name = msg.name || existing.name;
        existing.messages.push({
          direction: "in",
          id: msg.messageId || `in_${Date.now()}`,
          body: msg.body,
          type: msg.type,
          at: new Date(msg.timestamp).toISOString(),
        });

        const pending = newPendingLinks[msg.body];
        if (pending && Date.now() <= pending.expiresAt) {
          existing.connected = true;
          existing.appUserId = pending.appUserId;
          existing.scope = pending.scope;
          existing.linkedAt = new Date().toISOString();
          delete newPendingLinks[msg.body];
          linkedCount++;
        }

        newContacts[msg.waId] = existing;
        lastWaId = msg.waId;
        msgCount++;
      }

      const newState = { ...state, contacts: newContacts, pendingLinks: newPendingLinks, selectedWaId: lastWaId };
      setState(newState);
      await persistState(newState);
      
      setStatus(s => ({ ...s, payload: `Processed ${msgCount} incoming message(s). Connected ${linkedCount} account(s).` }));
    } catch (e) {
      setStatus(s => ({ ...s, payload: 'Invalid JSON. Paste the full payload object from Meta.' }));
    }
  };

  const sendMessage = async () => {
    const contact = state.selectedWaId ? state.contacts[state.selectedWaId] : null;
    if (!contact) {
      setStatus(s => ({ ...s, send: 'Select a connected contact first.' }));
      return;
    }

    if (!sendBody.trim()) {
      setStatus(s => ({ ...s, send: 'Message is empty.' }));
      return;
    }

    if (!state.config.accessToken || !state.config.phoneNumberId) {
      setStatus(s => ({ ...s, send: 'Access token and Phone Number ID are required.' }));
      return;
    }

    setStatus(s => ({ ...s, send: 'Sending...' }));

    try {
      const response = await fetch(`https://graph.facebook.com/v25.0/${state.config.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${state.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: contact.waId,
          type: "text",
          text: { body: sendBody },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(s => ({ ...s, send: `Send failed: ${data.error?.message || response.statusText}` }));
        return;
      }

      const newContacts = { ...state.contacts };
      newContacts[contact.waId].messages.push({
        direction: "out",
        id: data?.messages?.[0]?.id || `out_${Date.now()}`,
        body: sendBody,
        type: "text",
        at: new Date().toISOString(),
      });

      const newState = { ...state, contacts: newContacts };
      setState(newState);
      await persistState(newState);
      
      setStatus(s => ({ ...s, send: `Sent. Message ID: ${data?.messages?.[0]?.id || 'unknown'}` }));
    } catch (e: any) {
      setStatus(s => ({ ...s, send: `Send failed: ${e.message}` }));
    }
  };

  const sortedContacts = Object.values(state.contacts).sort((a, b) => {
    const aa = a.messages?.[a.messages.length - 1]?.at || a.linkedAt || "";
    const bb = b.messages?.[b.messages.length - 1]?.at || b.linkedAt || "";
    return bb.localeCompare(aa);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <Loader2 className="animate-spin" size={32} />
        <p>Loading your WhatsApp configuration...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white overflow-y-auto p-4 md:p-6 gap-6">
      {/* Header & Connection Status */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            WhatsApp Integration
            {Object.values(state.contacts).some(c => c.connected) ? (
              <span className="bg-lime-500/20 text-lime-400 border border-lime-500/30 text-xs px-3 py-1 rounded-full uppercase font-bold tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(132,204,22,.1)]">
                <CheckCircle2 size={12} /> Connected
              </span>
            ) : (
              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs px-3 py-1 rounded-full uppercase font-bold tracking-wider">
                Disconnected
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-1 max-w-2xl flex items-center gap-2">
            {Object.values(state.contacts).find(c => c.connected)?.waId ? (
              <>Linked ID: <span className="text-white font-mono bg-white/5 px-2 py-0.5 rounded">+{Object.values(state.contacts).find(c => c.connected)?.waId}</span></>
            ) : (
              <>Status: <span className="text-slate-300">Ready to pair with your device</span></>
            )}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={resetAll}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 border border-rose-800/30 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Trash2 size={16} /> Disconnect All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
        
        {/* Main Connection Prompt & QR */}
        <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6">
          <section className="bg-gradient-to-br from-slate-900/50 to-slate-900/20 border border-slate-800/60 p-8 rounded-[32px] flex flex-col md:flex-row items-center gap-10 shadow-xl overflow-hidden relative group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-lime-500/5 rounded-full blur-3xl group-hover:bg-lime-500/10 transition-all duration-700"></div>
            
            <div className="flex-1 flex flex-col gap-5 text-center md:text-left">
              <div className="inline-flex items-center justify-center md:justify-start gap-2 text-lime-400 font-bold text-sm uppercase tracking-[0.2em]">
                <QrCode size={16} /> Start Integration
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Connect your <span className="text-lime-500">WhatsApp</span>
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                Scan the QR code below using your mobile device to securely link your WhatsApp account with Beatrice AI.
              </p>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-2">
                <button 
                  onClick={generateQr}
                  className="flex items-center gap-2.5 bg-lime-500 text-black px-8 py-3.5 rounded-2xl text-base font-bold hover:bg-lime-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_25px_rgba(132,204,22,.25)]"
                >
                  <QrCode size={20} /> Generate New QR
                </button>
                {waLink && (
                  <a 
                    href={waLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 bg-slate-800 text-white px-6 py-3.5 rounded-2xl text-base font-bold hover:bg-slate-700 hover:border-slate-600 transition-all border border-slate-700/50"
                  >
                    <ExternalLink size={20} /> Open Protocol Link
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-5 rounded-[28px] shadow-2xl relative transition-transform duration-500 hover:rotate-1">
                <div className="w-64 h-64 flex items-center justify-center">
                  {qrUrl ? (
                    <img src={qrUrl} alt="WhatsApp QR" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-slate-900 font-bold text-center opacity-20 flex flex-col items-center gap-3">
                      <QrCode size={48} />
                      <span className="text-sm">Click the button<br/>to generate QR</span>
                    </div>
                  )}
                </div>
                {qrUrl && <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-lime-500 text-black text-[10px] font-black uppercase px-4 py-1 rounded-full shadow-lg">Scan Now</div>}
              </div>
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full border border-white/5 uppercase tracking-widest">
                Expires in 10 minutes
              </div>
            </div>
          </section>

          {/* Permissions Section */}
          <section className="bg-slate-900/40 border border-slate-800/60 p-8 rounded-[32px] flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <ListChecks size={24} className="text-lime-500" />
                  Access Permissions
                </h2>
                <p className="text-slate-400 mt-1">Configure what the AI agent can do on your behalf.</p>
              </div>
              <div className="hidden md:flex items-center gap-3 bg-black/40 border border-slate-800 rounded-full px-4 py-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auto-save:</span>
                <span className="text-[10px] font-bold text-lime-500 uppercase flex items-center gap-1.5"><CheckCircle2 size={10} /> Active</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {[
                { key: 'readMessages', label: 'Read WhatsApp Messages', desc: 'Allow AI to monitor incoming messages and understand conversation context.', icon: MessageSquare },
                { key: 'searchContacts', label: 'Search User Contacts', desc: 'Allow AI to lookup existing contacts in your WhatsApp address book.', icon: UserIcon },
                { key: 'sendMessages', label: 'Send Messages', desc: 'Allow AI to reply to customers and initiation conversations.', icon: Send },
                { key: 'manageContacts', label: 'Manage Contacts & Calls', desc: 'Allow AI to create new contacts and handle call requests/scheduling.', icon: Info },
                { key: 'automaticSender', label: 'Automatic Sender & Reminders', desc: 'Allow scheduled messaging and automated daily streak/reminder tasks.', icon: History },
              ].map((p) => {
                const Icon = p.icon;
                const isEnabled = state.permissions?.[p.key as keyof Permissions];
                return (
                  <div 
                    key={p.key}
                    onClick={() => togglePermission(p.key as keyof Permissions)}
                    className={`flex items-start gap-4 p-5 rounded-[24px] border cursor-pointer transition-all duration-300 ${
                      isEnabled 
                        ? 'bg-lime-500/10 border-lime-500/40 shadow-[inset_0_1px_20px_rgba(132,204,22,.05)]' 
                        : 'bg-black/20 border-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className={`p-3 rounded-2xl ${isEnabled ? 'bg-lime-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 flex flex-col gap-1 pr-2">
                      <span className={`font-bold transition-colors ${isEnabled ? 'text-white' : 'text-slate-400'}`}>{p.label}</span>
                      <span className="text-xs text-slate-500 leading-relaxed">{p.desc}</span>
                    </div>
                    {/* Radio Button Style Toggle */}
                    <div className="flex items-center justify-center pt-1">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isEnabled ? 'border-lime-500 bg-lime-500/10' : 'border-slate-700 bg-transparent'
                      }`}>
                        {isEnabled && <div className="w-3 h-3 rounded-full bg-lime-500 animate-in fade-in zoom-in duration-300" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Side Panel: Configuration & Tools */}
        <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-6">
          <section className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-[32px] flex flex-col gap-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Settings size={18} className="text-slate-500" />
              Developer Settings
            </h2>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Phone Number ID</label>
                <input 
                  type="text" 
                  value={state.config.phoneNumberId} 
                  onChange={e => setState(s => ({ ...s, config: { ...s.config, phoneNumberId: e.target.value } }))}
                  className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-lime-500 outline-none transition-all font-mono" 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">Temporary Access Token</label>
                <input 
                  type="password" 
                  value={state.config.accessToken} 
                  onChange={e => setState(s => ({ ...s, config: { ...s.config, accessToken: e.target.value } }))}
                  className="bg-black/40 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:border-lime-500 outline-none transition-all" 
                />
              </div>

              <button 
                onClick={saveConfig}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all border border-slate-700/50 mt-2"
              >
                <Save size={18} /> Update Server Settings
              </button>
            </div>

            <div className="mt-2 pt-4 border-t border-slate-800/60">
              <div className="bg-black/40 border border-slate-800/40 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-2">
                  <Info size={14} /> Local Status
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">{status.config}</p>
              </div>
            </div>
          </section>

          {/* Test Tools Panel (Foldable or smaller) */}
          <section className="bg-slate-900/10 border border-slate-800/40 p-6 rounded-[32px] flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-500 flex items-center gap-2 uppercase tracking-widest">
              Integration Inspector
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-slate-400">Manual Webhook Simulation:</p>
                <textarea 
                  value={payloadInput}
                  onChange={e => setPayloadInput(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-mono focus:border-lime-500 outline-none transition-all resize-none min-h-[80px]" 
                  placeholder='Paste JSON response...'
                />
                <button 
                  onClick={processPayload}
                  className="bg-slate-800 hover:bg-slate-700 text-[11px] font-bold py-2 rounded-lg transition-all"
                >
                  Verify Payload
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}
