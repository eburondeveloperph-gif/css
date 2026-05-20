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
    <div className="flex flex-col h-full text-slate-200 overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-8 pb-20">
        
        {/* Main Connection Box */}
        <div className="bg-slate-900/30 border border-slate-800/40 p-8 md:p-12 rounded-[32px] flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
          <div className="flex-1 flex flex-col gap-4 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              {Object.values(state.contacts).some(c => c.connected) ? (
                <span className="bg-lime-500/10 text-lime-400 text-xs px-3 py-1 rounded-full uppercase tracking-widest font-medium flex items-center gap-1.5 border border-lime-500/20">
                  <CheckCircle2 size={12} /> Connected
                </span>
              ) : (
                <span className="bg-white/5 text-slate-400 text-xs px-3 py-1 rounded-full uppercase tracking-widest font-medium border border-white/10">
                  Disconnected
                </span>
              )}
            </div>

            <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-white mt-2 mb-2">
              Connect your WhatsApp
            </h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-md mx-auto md:mx-0">
              Scan the QR code using your mobile device securely link your account with Beatrice AI.
            </p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
              <button 
                onClick={generateQr}
                className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-slate-200 transition-colors shadow-lg hover:shadow-xl"
              >
                <QrCode size={18} /> Generate Connection Link
              </button>
              {Object.values(state.contacts).some(c => c.connected) && (
                <button 
                  onClick={resetAll}
                  className="flex items-center gap-2 bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 px-6 py-3 rounded-full border border-rose-900/30 text-sm font-medium transition-colors"
                >
                  <Trash2 size={18} /> Disconnect
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-6 rounded-[32px] shadow-2xl relative w-56 h-56 flex items-center justify-center">
              {qrUrl ? (
                <img src={qrUrl} alt="WhatsApp QR" className="w-full h-full object-contain" />
              ) : (
                <div className="text-slate-900 opacity-20 flex flex-col items-center gap-3">
                  <QrCode size={48} />
                </div>
              )}
            </div>
            {qrUrl && (
              <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                Expires in 10 minutes
              </div>
            )}
          </div>
        </div>

        {/* Permissions Section */}
        <div className="bg-slate-900/30 border border-slate-800/40 p-8 md:p-12 rounded-[32px] flex flex-col gap-8">
          <div>
            <h3 className="text-2xl font-normal text-white">Access Permissions</h3>
            <p className="text-slate-400 text-sm mt-2">Configure what Beatrice AI can do on your behalf. These settings are instantly saved.</p>
          </div>

          <div className="flex flex-col gap-2">
            {[
              { key: 'readMessages', label: 'Read WhatsApp Messages', desc: 'Allow AI to monitor incoming messages and understand conversation context.', icon: MessageSquare },
              { key: 'searchContacts', label: 'Search User Contacts', desc: 'Allow AI to lookup existing contacts in your WhatsApp address book.', icon: UserIcon },
              { key: 'sendMessages', label: 'Send Messages', desc: 'Allow AI to reply to customers and initiate conversations.', icon: Send },
              { key: 'manageContacts', label: 'Manage Contacts & Calls', desc: 'Allow AI to create new contacts and handle call requests/scheduling.', icon: Info },
              { key: 'automaticSender', label: 'Automatic Sender & Reminders', desc: 'Allow scheduled messaging and automated daily streak/reminder tasks.', icon: History },
            ].map((p) => {
              const Icon = p.icon;
              const isEnabled = state.permissions?.[p.key as keyof Permissions];
              return (
                <div 
                  key={p.key}
                  onClick={() => togglePermission(p.key as keyof Permissions)}
                  className={`flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-300 ${
                    isEnabled 
                      ? 'bg-lime-500/5 hover:bg-lime-500/10' 
                      : 'hover:bg-slate-800/20'
                  }`}
                >
                  <div className={`p-4 rounded-full flex-shrink-0 transition-colors ${isEnabled ? 'bg-lime-500/10 text-lime-400' : 'bg-slate-800/50 text-slate-500'}`}>
                    <Icon size={20} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 flex flex-col gap-1 md:pr-4">
                    <span className={`text-base font-medium transition-colors ${isEnabled ? 'text-white' : 'text-slate-300'}`}>{p.label}</span>
                    <span className="text-sm text-slate-500 leading-relaxed">{p.desc}</span>
                  </div>
                  <div className="flex items-center self-start md:self-center mt-2 md:mt-0 pt-1">
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
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
