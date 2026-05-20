import React from 'react';
import { WhatsAppCloudConnector } from './WhatsAppCloudConnector';

export function WhatsAppIntegrationPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <WhatsAppCloudConnector />
      </div>
    </div>
  );
}
