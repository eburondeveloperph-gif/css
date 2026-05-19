import React, { useState, useEffect } from 'react';
import { MessageSquare, QrCode, User, Check, RefreshCw } from 'lucide-react';
import { connectWhatsapp } from '../lib/api-client';

export function WhatsAppIntegrationPanel() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const fetchConnection = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await connectWhatsapp();
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to connect to GoWA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnection();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', margin: '20px' }}>
          <MessageSquare size={48} color="#075e54" style={{ margin: '0 auto', opacity: 0.5, animation: 'pulse-anim 2s infinite' }} />
          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Connecting to WhatsApp node...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fee2e2', margin: '20px', borderRadius: '12px' }}>
          <p style={{ color: '#b91c1c' }}>{error}</p>
          <button onClick={fetchConnection} style={{ marginTop: '10px', padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>Retry</button>
        </div>
      ) : data?.data?.qr ? (
        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#e0f2f1', margin: '20px', borderRadius: '12px' }}>
          <img src={data.data.qr} alt="WhatsApp QR Code" style={{ width: '200px', height: '200px', margin: '0 auto', borderRadius: '8px' }} />
          <h3 style={{ color: '#075e54', marginTop: '16px' }}>Link Eburon to WhatsApp</h3>
          <p style={{ color: '#000', opacity: 0.7, marginTop: '8px' }}>Open WhatsApp on your phone, go to Linked Devices, and scan this code.</p>
          <button onClick={fetchConnection} style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#075e54', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 'bold', margin: '16px auto 0' }}>
            <RefreshCw size={16} /> Refresh QR
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#e0f2f1', margin: '20px', borderRadius: '12px' }}>
          <Check size={80} color="#25d366" style={{ margin: '0 auto' }} />
          <h3 style={{ color: '#075e54', marginTop: '16px' }}>WhatsApp Connected!</h3>
          <p style={{ color: '#000', opacity: 0.7, marginTop: '8px' }}>The assistant can now send messages.</p>
        </div>
      )}
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px' }}>
        <h4 style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Connection State</h4>
        {data?.raw_response?.results?.state === 'authenticated' || data?.raw_response?.results?.state === 'OPEN' ? (
           <p style={{ color: 'var(--text-muted)' }}>Scan successful. Connected to WhatsApp.</p>
        ) : (
           <pre style={{ backgroundColor: '#111', padding: '12px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', color: '#0f0' }}>
             {JSON.stringify(data, null, 2)}
           </pre>
        )}
      </div>
    </div>
  );
}
