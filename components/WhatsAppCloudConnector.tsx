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

interface State {
  config: WaConfig;
  pendingLinks: Record<string, any>;
  contacts: Record<string, Contact>;
  selectedWaId: string | null;
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
  });

  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [waLink, setWaLink] = useState<string>('');
  const [payloadInput, setPayloadInput] = useState<string>('');
  const [sendBody, setSendBody] = useState<string>('✅ Connected. Your WhatsApp is now linked to the AI test connector.');
  const [status, setStatus] = useState({
    config: 'Config not saved yet.',
    qr: 'No QR generated yet.',
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
          config: { ...prev.config, ...data.config }
        }));
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading WhatsApp config:", error);
      // Only handle if it's not a missing permission error during initial setup
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
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            WhatsApp Cloud Connector
            <span className="bg-amber-900/40 text-amber-500 border border-amber-800 text-xs px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Cloud Auth</span>
          </h1>
          <p className="text-slate-400 mt-1 max-w-2xl">
            Linked to your account: <span className="text-white font-medium">{auth.currentUser?.email}</span>
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={resetAll}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 border border-rose-800/50 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <Trash2 size={16} /> Reset All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
        
        {/* Step 1: Credentials */}
        <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Settings size={18} className="text-slate-500" />
            1. Credentials
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Business Phone Number</label>
              <input 
                type="text" 
                value={state.config.businessNumber} 
                onChange={e => setState(s => ({ ...s, config: { ...s.config, businessNumber: e.target.value } }))}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-lime-500 outline-none transition-all" 
                placeholder="15556375610"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone Number ID</label>
              <input 
                type="text" 
                value={state.config.phoneNumberId} 
                onChange={e => setState(s => ({ ...s, config: { ...s.config, phoneNumberId: e.target.value } }))}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-lime-500 outline-none transition-all" 
                placeholder="1148407841689522"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">WABA ID</label>
            <input 
              type="text" 
              value={state.config.wabaId} 
              onChange={e => setState(s => ({ ...s, config: { ...s.config, wabaId: e.target.value } }))}
              className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-lime-500 outline-none transition-all" 
              placeholder="1308236421503956"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Access Token</label>
            <input 
              type="password" 
              value={state.config.accessToken} 
              onChange={e => setState(s => ({ ...s, config: { ...s.config, accessToken: e.target.value } }))}
              className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-lime-500 outline-none transition-all font-mono" 
              placeholder="Paste Meta temporary token"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">App User ID (Auto)</label>
              <input 
                type="text" 
                value={appUserId} 
                onChange={e => setAppUserId(e.target.value)}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-lime-500 outline-none transition-all opacity-70" 
                placeholder="test-user-001"
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scope</label>
              <select 
                value={scope} 
                onChange={e => setScope(e.target.value)}
                className="bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:border-lime-500 outline-none transition-all"
              >
                <option value="receive_only">Receive only</option>
                <option value="send_only_after_approval">Send only after approval</option>
                <option value="receive_and_send">Receive and send</option>
                <option value="all_allowed_by_user">All allowed by user</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button 
              onClick={generateQr}
              className="flex items-center gap-2 bg-lime-500 text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-lime-400 transition-all"
            >
              <QrCode size={18} /> Generate QR
            </button>
            <button 
              onClick={saveConfig}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
            >
              <Save size={18} /> Save Settings
            </button>
            {waLink && (
              <a 
                href={waLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all border border-slate-700"
              >
                <ExternalLink size={18} /> Open WhatsApp
              </a>
            )}
          </div>

          <div className="bg-black/60 border border-slate-800/50 rounded-xl p-3 text-xs text-slate-400 flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <p>{status.config}</p>
          </div>
        </section>

        {/* Step 2: QR Display */}
        <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <QrCode size={18} className="text-slate-500" />
            2. Scan QR
          </h2>
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl min-h-[300px] p-6 relative group overflow-hidden">
            {qrUrl ? (
              <img src={qrUrl} alt="WhatsApp QR" className="w-full max-w-[260px] h-auto object-contain" />
            ) : (
              <p className="text-slate-900 font-medium text-center opacity-40">
                Click <strong>Generate QR</strong> to create a deep-link.
              </p>
            )}
          </div>
          <div className="bg-black/60 border border-slate-800/50 rounded-xl p-3 text-xs text-slate-400 whitespace-pre-wrap flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <p>{status.qr}</p>
          </div>
        </section>

        {/* Step 3: Webhook Payload */}
        <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Link size={18} className="text-slate-500" />
            3. Paste Webhook Payload
          </h2>
          <p className="text-sm text-slate-400">
            Paste the JSON payload you receive in your webhook endpoint (or test panel).
          </p>
          <textarea 
            value={payloadInput}
            onChange={e => setPayloadInput(e.target.value)}
            className="flex-1 bg-black/40 border border-slate-800 rounded-xl px-3 py-3 text-xs font-mono focus:border-lime-500 outline-none transition-all resize-none min-h-[140px]" 
            placeholder='Paste payload with "messages": [{ "from": "...", "text": { "body": "LINK_..." } }]'
          />
          <div className="flex gap-2">
            <button 
              onClick={processPayload}
              className="flex-1 flex items-center justify-center gap-2 bg-lime-500 text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-lime-400 transition-all"
            >
              Process Payload
            </button>
            <button 
              onClick={() => setPayloadInput('')}
              className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
            >
              Clear
            </button>
          </div>
          <div className="bg-black/60 border border-slate-800/50 rounded-xl p-3 text-xs text-slate-400 flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <p>{status.payload}</p>
          </div>
        </section>

        {/* Step 4: Contacts */}
        <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserIcon size={18} className="text-slate-500" />
            4. Connected Contacts
          </h2>
          <div className="flex-1 overflow-y-auto max-h-[370px] pr-2 custom-scrollbar">
            {sortedContacts.length > 0 ? (
              <div className="flex flex-col gap-3">
                {sortedContacts.map(c => (
                  <div 
                    key={c.waId} 
                    onClick={() => setState(s => ({ ...s, selectedWaId: c.waId }))}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      state.selectedWaId === c.waId 
                        ? 'bg-lime-500/10 border-lime-500/50 ring-1 ring-lime-500/20' 
                        : 'bg-black/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <strong className="font-bold flex items-center gap-2">
                        {c.name || c.waId}
                        {c.connected ? (
                          <span className="bg-lime-900/40 text-lime-400 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border border-lime-800/50">Linked</span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold">Unlinked</span>
                        )}
                      </strong>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1 text-xs text-slate-400">
                      <span>WA ID:</span> <span className="text-slate-300 font-mono text-[10px]">{c.waId}</span>
                      <span>App User:</span> <span className="text-slate-300">{c.appUserId || '-'}</span>
                      <span>Scope:</span> <span className="text-slate-300">{c.scope || '-'}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800/50 text-xs text-slate-500 truncate">
                      Last: {c.messages[c.messages.length - 1]?.body || 'No messages'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                <AlertTriangle size={32} className="mb-3" />
                <p className="text-sm">No connected contacts yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* Step 5: Messages */}
        <section className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-4 lg:col-span-2">
           <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <History size={18} className="text-slate-500" />
              5. Message Stream
            </h2>
            {state.selectedWaId && (
              <span className="text-xs font-mono text-lime-500 bg-lime-500/10 px-2 py-1 rounded-lg border border-lime-500/20">
                {state.selectedWaId}
              </span>
            )}
           </div>

           <div className="bg-black/40 border border-slate-800 rounded-2xl flex flex-col min-h-[300px] max-h-[500px]">
             {state.selectedWaId ? (
               <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {state.contacts[state.selectedWaId].messages.map((m, idx) => (
                    <div key={idx} className={`flex flex-col ${m.direction === 'out' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl ${
                        m.direction === 'out' 
                          ? 'bg-lime-500 text-black rounded-tr-none shadow-lg shadow-lime-500/10' 
                          : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                      }`}>
                        <div className={`text-[10px] mb-1 opacity-60 font-bold uppercase tracking-wider ${m.direction === 'out' ? 'text-black/70' : 'text-slate-400'}`}>
                          {m.direction === 'out' ? 'Outgoing' : 'Incoming'} • {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</div>
                      </div>
                    </div>
                  ))}
                  {state.contacts[state.selectedWaId].messages.length === 0 && (
                     <div className="h-full flex items-center justify-center opacity-30 text-sm">No messages in this chat.</div>
                  )}
                </div>
                
                {/* 6. Send Box */}
                <div className="p-4 border-t border-slate-800 bg-black/20">
                  <div className="flex flex-col gap-3">
                    <textarea 
                      value={sendBody}
                      onChange={e => setSendBody(e.target.value)}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-lime-500 outline-none transition-all resize-none min-h-[80px]" 
                      placeholder="Type a message to send..."
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        {status.send}
                      </p>
                      <button 
                        onClick={sendMessage}
                        className="flex items-center gap-2 bg-lime-500 text-black px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-lime-400 transition-all shadow-lg shadow-lime-500/20 active:scale-95"
                      >
                        <Send size={18} /> Send Message
                      </button>
                    </div>
                  </div>
                </div>
               </>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                  <MessageSquare size={48} className="mb-4 text-slate-600" />
                  <p className="text-sm font-medium">Select a contact from the list to view conversation.</p>
               </div>
             )}
           </div>
        </section>
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
