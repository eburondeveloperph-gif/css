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
    <div className="flex flex-col h-full bg-[#09090b] text-slate-200 overflow-y-auto p-4 md:p-8 relative custom-scrollbar font-sans">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 pb-20 mt-4 md:mt-8">
        
        {/* Main Connection Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
            WhatsApp Integration
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl">
            Link your WhatsApp account to enable Beatrice AI to communicate on your behalf. Scan the QR code with your mobile device to establish a secure connection.
          </p>
        </div>

        {/* QR Code Card */}
        <div className="bg-[#18181b] border border-white/5 rounded-3xl p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl">
          <div className="flex-1 flex flex-col gap-6 w-full">
            <div className="flex items-center gap-3">
              {Object.values(state.contacts).some(c => c.connected) ? (
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  CONNECTED
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-white/5 text-slate-400 border border-white/10 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide">
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                  DISCONNECTED
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-medium text-white">Device Pairing</h3>
              <p className="text-slate-400 text-sm">
                Generate a temporary QR code to link your current session.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 mt-2">
              <button 
                onClick={generateQr}
                className="inline-flex items-center justify-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all focus:ring-2 focus:ring-white/20 active:scale-[0.98]"
              >
                <QrCode size={18} /> {qrUrl ? 'Regenerate QR Code' : 'Generate QR Code'}
              </button>
              {Object.values(state.contacts).some(c => c.connected) && (
                <button 
                  onClick={resetAll}
                  className="inline-flex items-center justify-center gap-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-6 py-2.5 rounded-xl border border-rose-500/20 text-sm font-medium transition-all active:scale-[0.98]"
                >
                  <Trash2 size={18} /> Disconnect Device
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-xl border border-white/10 relative w-48 h-48 flex items-center justify-center overflow-hidden group transition-all">
              {qrUrl ? (
                <div className="relative w-full h-full animate-in fade-in zoom-in duration-500">
                   <img src={qrUrl} alt="WhatsApp QR" className="w-full h-full object-contain mix-blend-multiply" />
                </div>
              ) : (
                <div className="text-slate-300 flex flex-col items-center justify-center h-full gap-2 transition-opacity">
                  <QrCode size={32} strokeWidth={1.5} />
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Scan Me</span>
                </div>
              )}
            </div>
            <div className="h-4">
              {qrUrl && (
                <span className="text-[#a1a1aa] text-[10px] font-mono uppercase tracking-widest animate-in fade-in duration-500">
                  Code expires in 10:00
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Permissions Configuration */}
        <div className="flex flex-col gap-6 mt-4">
          <div className="flex flex-col gap-1 border-b border-white/5 pb-4">
            <h3 className="text-xl font-medium text-white">Agent Permissions</h3>
            <p className="text-slate-400 text-sm">
              Select precisely what Beatrice is authorized to perform on your connected device.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'readMessages', label: 'Read Messages', desc: 'Allow AI to monitor incoming messages and understand conversation context.', icon: MessageSquare },
              { key: 'sendMessages', label: 'Send Messages', desc: 'Allow AI to reply to customers and initiate conversations.', icon: Send },
              { key: 'searchContacts', label: 'Search Contacts', desc: 'Allow AI to lookup existing contacts in your address book.', icon: UserIcon },
              { key: 'manageContacts', label: 'Manage Contacts', desc: 'Allow AI to create new contacts and handle call requests.', icon: Info },
              { key: 'automaticSender', label: 'Background Automation', desc: 'Allow scheduled messaging and automated daily streak/reminder tasks.', icon: History },
            ].map((p) => {
              const Icon = p.icon;
              const isEnabled = state.permissions?.[p.key as keyof Permissions];
              return (
                <div 
                  key={p.key}
                  onClick={() => togglePermission(p.key as keyof Permissions)}
                  className={`flex flex-row items-center justify-between p-5 rounded-2xl cursor-pointer border transition-all duration-200 ${
                    isEnabled 
                      ? 'bg-[#18181b] border-white/10 shadow-sm' 
                      : 'bg-[#18181b]/50 border-transparent hover:bg-[#18181b]/80'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl transition-colors duration-300 ${isEnabled ? 'bg-white text-black' : 'bg-white/5 text-slate-400'}`}>
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-sm font-medium transition-colors ${isEnabled ? 'text-white' : 'text-slate-300'}`}>{p.label}</span>
                      <span className="text-xs text-slate-500 leading-relaxed max-w-[200px] line-clamp-2" title={p.desc}>{p.desc}</span>
                    </div>
                  </div>
                  
                  {/* Modern Toggle Switch */}
                  <div className="ml-4 flex-shrink-0">
                    <div className={`w-11 h-6 rounded-full transition-colors duration-300 relative flex items-center px-1 border ${
                      isEnabled ? 'bg-white border-white' : 'bg-transparent border-white/20'
                    }`}>
                      <div className={`w-4 h-4 rounded-full transition-all duration-300 transform shadow-sm ${
                        isEnabled ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white/40'
                      }`} />
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
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
