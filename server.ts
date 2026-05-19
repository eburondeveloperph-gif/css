import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

// Constants for production pathing
const IS_PROD = process.env.NODE_ENV === 'production';
const DIST_PATH = path.join(process.cwd(), 'dist');

// Initialize Firebase Admin lazily
let adminInitialized = false;
function getFirebaseAdmin() {
  if (!adminInitialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    
    // Always call initializeApp, even if projectId is undefined (it might work with local credentials or environment settings)
    try {
      admin.initializeApp(projectId ? { projectId } : {});
      adminInitialized = true;
      console.log('Firebase Admin initialized', projectId ? `with project ID: ${projectId}` : 'with default credentials');
    } catch (e) {
      console.error('Firebase Admin initialization failed:', e);
      throw new Error('Firebase Admin initialization failed: ' + e);
    }
  }
  return admin;
}

// Initialize Supabase (Optional fallback)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize Google GenAI lazily
let genAI: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set. AI features in webhook will be disabled.');
      return null;
    }
    genAI = new GoogleGenAI(apiKey);
  }
  return genAI;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // Auth Middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    try {
      const decodedToken = await getFirebaseAdmin().auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.sendStatus(403);
    }
  };

  // API Routes
  // Document Generation API
  app.post('/api/documents/generate', (req, res) => {
    const { docId, data } = req.body;
    
    const money = (v: any) => new Intl.NumberFormat("en-BE", { style: "currency", currency: "EUR" }).format(Number(v || 0));
    const nl2br = (s: string) => (s || '').replace(/\n/g, "<br>");
    const escapeHTML = (s: string) => String(s ?? "").replace(/[&<>"']/g, m => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" } as any)[m] || m));

    const docCSS = () => `
      :root{--gold:#D4A017;--charcoal:#1A1A1A}*{box-sizing:border-box}
      body{margin:0;background:#e9e9e9;color:#151515;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
      .page{width:794px;min-height:1123px;margin:0 auto;background:#fff;padding:52px 58px;box-shadow:0 20px 80px rgba(0,0,0,.18);position:relative}
      .top-line{position:absolute;left:0;right:0;top:0;height:8px;background:var(--gold)}
      header{display:flex;justify-content:space-between;gap:26px;align-items:flex-start;border-bottom:2px solid var(--gold);padding-bottom:18px;margin-bottom:30px}
      .doc-brand{display:flex;gap:12px;align-items:center}
      .doc-brand img{width:42px;height:42px}
      .doc-brand strong{display:block;color:var(--gold);letter-spacing:1px;font-size:17px}
      .doc-brand span{display:block;color:#777;letter-spacing:1.7px;font-size:9px;font-weight:700}
      .company{font-size:10.5px;line-height:1.55;color:#333;text-align:right}
      h1{color:#151515;font-size:28px;letter-spacing:-.5px;margin:0 0 8px;text-transform:uppercase}
      h2{color:var(--gold);font-size:15px;text-transform:uppercase;letter-spacing:.7px;margin:28px 0 10px}
      p,li{font-size:12px;line-height:1.75;color:#333}
      .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0 24px}
      .meta-box{background:#f7f7f7;border-left:4px solid var(--gold);padding:12px;font-size:11.5px;line-height:1.65;color:#333}
      .meta-box strong{color:#111}
      .doc-no{display:inline-block;background:var(--charcoal);color:#fff;padding:6px 9px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.4px}
      table{width:100%;border-collapse:collapse;margin:16px 0;font-size:11.5px}
      th{background:var(--gold);color:#111;text-align:left;padding:9px;font-size:10px;text-transform:uppercase;letter-spacing:.4px}
      td{border-bottom:1px solid #e7e7e7;padding:9px;vertical-align:top;color:#333}
      .total td{font-weight:800;color:#111}
      .notice{background:#fff9e8;border:1px solid #f0d68b;padding:12px;border-radius:8px;margin:16px 0}
      .signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:46px}
      .sig{border-top:1px solid #111;padding-top:8px;font-size:11px;color:#333;min-height:74px}
      .signature-pad{border:1px dashed #c99a17;height:80px;border-radius:8px;margin-top:10px;display:grid;place-items:center;color:#999;font-size:11px}
      footer{position:absolute;left:58px;right:58px;bottom:34px;border-top:1px solid #ddd;padding-top:10px;display:flex;justify-content:space-between;font-size:9px;color:#777}
      .watermark{position:absolute;right:50px;bottom:92px;opacity:.035;width:220px}
      @media print{body{background:#fff}.page{box-shadow:none;margin:0;width:auto;min-height:auto}}
    `;

    const docHeader = (d: any) => `
      <div class="top-line"></div>
      <header>
        <div class="doc-brand"><img src="https://eburon.ai/icon-eburon.svg" alt="Eburon AI"><div><strong>EBURON AI</strong><span>ARIOLAS BV</span></div></div>
        <div class="company">${nl2br(d.company_address)}<br>${escapeHTML(d.company_email)}<br>${escapeHTML(d.company_website)}</div>
      </header>
    `;

    const signBlock = (d: any, label: string) => `
      <section><h2>Electronic Signature</h2><p>By signing below, the signer confirms authority to sign and agrees that this document may be executed electronically.</p>
      <div class="signature-grid">
        <div class="sig">For Eburon AI / Ariolas BV<br><strong>${escapeHTML(d.signer_name)}</strong><br>${escapeHTML(d.signer_title)}<div class="signature-pad">Signature</div>Date: ${escapeHTML(d.signed_date)}</div>
        <div class="sig">For ${escapeHTML(label || "Client / Counterparty")}<br><strong>${escapeHTML(d.counterparty_name || d.approver_name || "")}</strong><br>Authorized Signatory<div class="signature-pad">Signature</div>Date: __________________</div>
      </div></section>
    `;

    const wrapDoc = (title: string, d: any, content: string) => `
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHTML(title)} | Eburon AI</title><style>${docCSS()}</style></head>
      <body><main class="page">${docHeader(d)}${content}<img class="watermark" src="https://eburon.ai/icon-eburon.svg" alt=""><footer><span>Eburon AI / Ariolas BV</span><span>${escapeHTML(title)} · Generated HTML Template</span></footer></main></body></html>
    `;

    const qty = Number(data.qty_1 || 0), rate = Number(data.rate_1 || data.fee || 0), subtotal = qty * rate, vat = subtotal * 0.21, total = subtotal + vat;
    let content = "";
    let title = docId;

    switch(docId) {
      case "letterhead":
        title = "Letterhead";
        content = `<span class="doc-no">Official Letterhead</span><div style="height:34px"></div><p>${escapeHTML(data.issue_date)}</p><div class="meta-grid"><div class="meta-box"><strong>To</strong><br>${escapeHTML(data.recipient_name)}<br>${escapeHTML(data.recipient_company)}<br>${nl2br(data.recipient_address)}</div><div class="meta-box"><strong>Subject</strong><br>${escapeHTML(data.subject)}</div></div><h1>${escapeHTML(data.subject)}</h1><p>${nl2br(data.body)}</p><p>Sincerely,</p><p><strong>${escapeHTML(data.sender_name)}</strong><br>${escapeHTML(data.sender_title)}<br>Eburon AI / Ariolas BV</p>`;
        break;
      case "invoice":
        title = "Invoice";
        content = `<h1>Invoice</h1><p><span class="doc-no">${escapeHTML(data.invoice_no)}</span></p><div class="meta-grid"><div class="meta-box"><strong>Bill To</strong><br>${escapeHTML(data.client_company)}<br>VAT: ${escapeHTML(data.client_vat)}<br>${nl2br(data.client_address)}</div><div class="meta-box"><strong>Issue Date</strong>: ${escapeHTML(data.issue_date)}<br><strong>Due Date</strong>: ${escapeHTML(data.due_date)}<br><strong>Payment Terms</strong>: ${escapeHTML(data.payment_terms)}</div></div><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody><tr><td>${escapeHTML(data.item_1)}</td><td>${escapeHTML(data.qty_1)}</td><td>${money(rate)}</td><td>${money(subtotal)}</td></tr><tr><td colspan="3">VAT 21%</td><td>${money(vat)}</td></tr><tr class="total"><td colspan="3">Amount Due</td><td>${money(total)}</td></tr></tbody></table><div class="notice"><p><strong>Payment Method:</strong> Bank transfer. Please include invoice number ${escapeHTML(data.invoice_no)} as payment reference.</p></div>`;
        break;
      case "quotation":
        title = "Quotation";
        content = `<h1>Quotation</h1><p><span class="doc-no">${escapeHTML(data.quote_no)}</span></p><div class="meta-grid"><div class="meta-box"><strong>Prepared For</strong><br>${escapeHTML(data.client_company)}<br>${nl2br(data.client_address)}</div><div class="meta-box"><strong>Issue Date</strong>: ${escapeHTML(data.issue_date)}<br><strong>Valid Until</strong>: ${escapeHTML(data.valid_until)}<br><strong>Prepared By</strong>: Eburon AI</div></div><h2>Scope</h2><p>${nl2br(data.scope)}</p><table><thead><tr><th>Service</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody><tr><td>${escapeHTML(data.item_1)}</td><td>${escapeHTML(data.qty_1)}</td><td>${money(rate)}</td><td>${money(subtotal)}</td></tr><tr><td colspan="3">VAT 21%</td><td>${money(vat)}</td></tr><tr class="total"><td colspan="3">Quoted Total</td><td>${money(total)}</td></tr></tbody></table><div class="notice"><p>Approval authorizes Eburon AI / Ariolas BV to prepare the corresponding agreement or invoice.</p></div>${signBlock(data, data.client_company)}`;
        break;
      case "business-letter":
        title = "Business Letter";
        content = `<h1>Business Letter</h1><p>${escapeHTML(data.issue_date)}</p><div class="meta-box"><strong>Recipient</strong><br>${escapeHTML(data.recipient_name)}<br>${escapeHTML(data.recipient_company)}<br>${nl2br(data.recipient_address)}</div><h2>${escapeHTML(data.subject)}</h2><p>Dear ${escapeHTML(data.recipient_name)},</p><p>${nl2br(data.body)}</p><p>Kind regards,</p><p><strong>${escapeHTML(data.sender_name)}</strong><br>${escapeHTML(data.sender_title)}<br>Eburon AI / Ariolas BV</p>${signBlock(data, data.recipient_company)}`;
        break;
      case "service-policy":
        title = "Service Policy";
        content = `<h1>Service Policy</h1><p><span class="doc-no">Version ${escapeHTML(data.policy_version)} · Effective ${escapeHTML(data.effective_date)}</span></p><h2>1. Purpose</h2><p>This Service Policy explains how ${escapeHTML(data.company_name)} delivers AI consulting, automation implementation, support, and related services.</p><h2>2. Service Scope</h2><p>Services may include discovery, workflow analysis, AI automation design, implementation, testing, documentation, training, and support.</p><h2>3. Client Responsibilities</h2><p>Clients must provide timely access to required systems, accurate information, responsible decision makers, and feedback needed for delivery.</p><h2>4. Delivery Standards</h2><p>Eburon AI aims to deliver professional, secure, and measurable AI solutions with clear milestones and acceptance criteria.</p><h2>5. Support</h2><p>Support requests can be submitted to ${escapeHTML(data.contact_email)}.</p>`;
        break;
      case "terms":
        title = "Terms & Conditions";
        content = `<h1>Terms & Conditions</h1><p><span class="doc-no">Version ${escapeHTML(data.policy_version)} · Effective ${escapeHTML(data.effective_date)}</span></p><h2>1. Applicability</h2><p>These Terms & Conditions apply to proposals, services, deliverables, support, and commercial engagements with ${escapeHTML(data.company_name)} unless replaced by a signed agreement.</p><h2>2. Fees and Payment</h2><p>Invoices must be paid according to the stated payment terms. Late payments may pause delivery or support obligations.</p><h2>3. Intellectual Property</h2><p>Pre-existing tools, frameworks, templates, methods, and know-how remain the property of their original owner.</p><h2>4. Liability</h2><p>Liability is limited to the amount paid for the relevant service unless mandatory law provides otherwise.</p><h2>5. Governing Law</h2><p>These terms are governed by ${escapeHTML(data.governing_law)}.</p>${signBlock(data, "Client")}`;
        break;
      case "privacy":
        title = "Privacy Policy";
        content = `<h1>Privacy Policy</h1><p><span class="doc-no">Version ${escapeHTML(data.policy_version)} · Effective ${escapeHTML(data.effective_date)}</span></p><h2>1. Controller</h2><p>${escapeHTML(data.company_name)} acts as data controller for personal data collected through business communications, websites, and service delivery unless otherwise stated.</p><h2>2. Data We Process</h2><p>We may process identification data, contact details, business communications, project information, technical logs, and billing details.</p><h2>3. Purposes</h2><p>Data is used to communicate, deliver services, manage contracts, invoice, improve security, and comply with legal obligations.</p><h2>4. Retention</h2><p>Personal data is retained only as long as necessary for the relevant purpose, contract, or legal obligation.</p><h2>5. Rights</h2><p>Data subjects may request access, correction, deletion, restriction, portability, or objection by contacting ${escapeHTML(data.dpo_email || data.contact_email)}.</p>`;
        break;
      case "gdpr":
        title = "GDPR Compliance Statement";
        content = `<h1>GDPR Compliance Statement</h1><p><span class="doc-no">Version ${escapeHTML(data.policy_version)} · Effective ${escapeHTML(data.effective_date)}</span></p><h2>1. Compliance Commitment</h2><p>${escapeHTML(data.company_name)} is committed to GDPR principles: lawfulness, fairness, transparency, purpose limitation, data minimization, accuracy, storage limitation, integrity, and confidentiality.</p><h2>2. Processor / Controller Roles</h2><p>Where services involve client data, the applicable agreement defines whether ${escapeHTML(data.processor_name)} acts as processor or controller.</p><h2>3. Security Measures</h2><p>Measures may include access control, encrypted storage/transmission where applicable, logging, least-privilege access, and supplier review.</p><h2>4. Data Subject Requests</h2><p>Requests are managed through ${escapeHTML(data.dpo_email || data.contact_email)} and handled within applicable legal timelines.</p><h2>5. Breach Handling</h2><p>Potential personal data breaches are assessed, documented, and escalated according to GDPR notification obligations.</p>${signBlock(data, "Compliance Owner")}`;
        break;
      case "service-agreement":
        title = "Service Agreement";
        content = `<h1>Service Agreement</h1><p><span class="doc-no">${escapeHTML(data.agreement_no)}</span></p><div class="meta-grid"><div class="meta-box"><strong>Provider</strong><br>Eburon AI / Ariolas BV<br>${nl2br(data.company_address)}</div><div class="meta-box"><strong>Client</strong><br>${escapeHTML(data.client_company)}<br>${nl2br(data.client_address)}</div></div><h2>1. Scope of Services</h2><p>${nl2br(data.scope)}</p><h2>2. Term</h2><p>This Agreement starts on ${escapeHTML(data.effective_date)} and continues until ${escapeHTML(data.end_date)} unless terminated earlier.</p><h2>3. Fees</h2><p>The agreed service fee is ${money(data.fee)}. Payment terms: ${escapeHTML(data.payment_terms)}.</p><h2>4. Confidentiality</h2><p>Both parties agree to protect confidential information and use it only for the purposes of this Agreement.</p><h2>5. Deliverables and Acceptance</h2><p>Deliverables are accepted when they materially conform to the agreed scope or when the client uses them in production.</p>${signBlock(data, data.client_company)}`;
        break;
      case "employment":
        title = "Employment Contract";
        content = `<h1>Employment Contract</h1><div class="meta-grid"><div class="meta-box"><strong>Employer</strong><br>Eburon AI / Ariolas BV<br>${nl2br(data.company_address)}</div><div class="meta-box"><strong>Employee</strong><br>${escapeHTML(data.employee_name)}<br>${nl2br(data.employee_address)}</div></div><h2>1. Position</h2><p>The employee is appointed as <strong>${escapeHTML(data.role_title)}</strong>.</p><h2>2. Start Date and Location</h2><p>Employment starts on ${escapeHTML(data.start_date)}. Work location: ${escapeHTML(data.work_location)}.</p><h2>3. Compensation</h2><p>Salary / compensation: ${escapeHTML(data.salary)}. Final compensation must be confirmed in the signed employment schedule.</p><h2>4. Duties</h2><p>The employee will perform duties reasonably associated with the role and support AI automation, client delivery, documentation, and internal operations.</p><h2>5. Confidentiality</h2><p>The employee must keep company, client, technical, commercial, and personal information confidential during and after employment.</p>${signBlock(data, data.employee_name)}`;
        break;
      case "nda":
        title = "Non-Disclosure Agreement";
        content = `<h1>Non-Disclosure Agreement</h1><div class="meta-grid"><div class="meta-box"><strong>Disclosing / Receiving Party</strong><br>Eburon AI / Ariolas BV<br>${nl2br(data.company_address)}</div><div class="meta-box"><strong>Counterparty</strong><br>${escapeHTML(data.counterparty_name)}<br>${nl2br(data.counterparty_address)}</div></div><h2>1. Purpose</h2><p>${nl2br(data.purpose)}</p><h2>2. Confidential Information</h2><p>Confidential Information includes business, technical, financial, client, product, AI system, workflow, documentation, and strategic information shared in any form.</p><h2>3. Obligations</h2><p>The receiving party must protect Confidential Information, restrict access to authorized persons, and not use it outside the stated purpose.</p><h2>4. Term</h2><p>Confidentiality obligations remain in force for ${escapeHTML(data.confidentiality_term)} from the effective date unless a longer period applies by law.</p><h2>5. Return or Destruction</h2><p>Upon request, the receiving party must return or destroy Confidential Information except archival copies required by law or compliance obligations.</p>${signBlock(data, data.counterparty_name)}`;
        break;
      case "freelancer":
        title = "Freelancer Agreement";
        content = `<h1>Freelancer Agreement</h1><div class="meta-grid"><div class="meta-box"><strong>Client</strong><br>Eburon AI / Ariolas BV<br>${nl2br(data.company_address)}</div><div class="meta-box"><strong>Freelancer</strong><br>${escapeHTML(data.freelancer_name)}<br>${nl2br(data.freelancer_address)}</div></div><h2>1. Project</h2><p><strong>${escapeHTML(data.project_name)}</strong></p><h2>2. Deliverables</h2><p>${nl2br(data.deliverables)}</p><h2>3. Fees and Payment</h2><p>Fee: ${money(data.fee)}. Payment terms: ${escapeHTML(data.payment_terms)}.</p><h2>4. Independent Contractor</h2><p>The freelancer acts as an independent contractor and is responsible for applicable taxes, insurance, tools, and work methods unless otherwise agreed.</p><h2>5. Intellectual Property</h2><p>Upon full payment, project-specific deliverables are assigned to Eburon AI / Ariolas BV except pre-existing freelancer tools and materials.</p>${signBlock(data, data.freelancer_name)}`;
        break;
      default:
        return res.status(400).json({ error: "Invalid document ID" });
    }

    const html = wrapDoc(title, data, content);
    res.send(html);
  });

  app.get('/api/avatar', (req, res) => {
    // Return Beatrice avatar URL or image
    res.redirect('https://ui-avatars.com/api/?name=Beatrice&background=cbfb45&color=000&size=200');
  });

  // Settings (Migrated to Firestore)
  app.get('/api/settings', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirebaseAdmin().firestore();
      const doc = await firestore.collection('users').doc(req.user.uid).get();
      if (!doc.exists) {
        return res.json({
          persona_name: 'Beatrice',
          user_call_name: 'Boss',
          voice: 'Puck',
          language: 'English',
          system_prompt: 'Classic Beatrice behavior.'
        });
      }
      res.json(doc.data());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/settings', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirebaseAdmin().firestore();
      await firestore.collection('users').doc(req.user.uid).set({
        ...req.body,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Memories (Migrated to Firestore)
  app.get('/api/memories', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirebaseAdmin().firestore();
      const userDoc = await firestore.collection('users').doc(req.user.uid).get();
      const memories = userDoc.exists ? (userDoc.data()?.memories || []) : [];
      res.json(memories);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/memories', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirebaseAdmin().firestore();
      const memory = {
        id: Math.random().toString(36).substring(7),
        ...req.body,
        created_at: new Date().toISOString()
      };
      await firestore.collection('users').doc(req.user.uid).update({
        memories: admin.firestore.FieldValue.arrayUnion(memory),
        updatedAt: new Date().toISOString()
      });
      res.status(201).json(memory);
    } catch (e: any) {
      // If user doc doesn't exist, create it
      if (e.code === 5 || e.message.includes('NOT_FOUND')) {
        const firestore = getFirebaseAdmin().firestore();
        const memory = {
          id: Math.random().toString(36).substring(7),
          ...req.body,
          created_at: new Date().toISOString()
        };
        await firestore.collection('users').doc(req.user.uid).set({
          memories: [memory],
          updatedAt: new Date().toISOString()
        });
        return res.status(201).json(memory);
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/memories/:id', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirebaseAdmin().firestore();
      const userDoc = await firestore.collection('users').doc(req.user.uid).get();
      if (!userDoc.exists) return res.sendStatus(404);
      
      const memories = userDoc.data()?.memories || [];
      const updatedMemories = memories.filter((m: any) => m.id !== req.params.id);
      
      await firestore.collection('users').doc(req.user.uid).update({
        memories: updatedMemories,
        updatedAt: new Date().toISOString()
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Search Proxy
  app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
    if (!apiKey || !cx) return res.json({ results: [`Google Search not configured on server.`] });
    
    try {
      const searchRes = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q as string)}`);
      const data = await searchRes.json();
      const results = data.items?.map((item: any) => `${item.title}: ${item.snippet} (${item.link})`) || [];
      res.json({ results });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // WhatsApp Proxy
  app.post('/api/whatsapp/webhook', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    const secret = process.env.GOWA_WEBHOOK_SECRET || 'secret';
    
    if (signature) {
        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
        if (signature !== digest) {
            console.warn('Webhook signature mismatch');
            return res.status(401).send('Unauthorized');
        }
    }

    const { event, payload, device_id } = req.body;
    console.log(`WhatsApp Event Received: ${event} from ${device_id}`);

    // Store event in Firestore
    try {
        const firestore = getFirebaseAdmin().firestore();
        await firestore.collection('whatsapp_events').add({
            event,
            payload,
            device_id,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.warn('Failed to store WhatsApp event:', e);
    }

    // Auto-respond to messages if it's Beatrice's turn
    if (event === 'message' && payload && !payload.is_from_me) {
        const body = payload.body || '';
        const phone = payload.from;
        
        if (body && phone && getGenAI()) {
            try {
                const model = getGenAI()!.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `You are Beatrice, a powerful AI assistant. You just received a WhatsApp message: "${body}". Respond as Beatrice. Keep it concise and helpful.`;
                const result = await model.generateContent(prompt);
                const response = result.response.text();
                
                // Send response back via WhatsApp
                const gowaUrl = process.env.GOWA_API_URL;
                if (gowaUrl) {
                    const headers: any = {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${Buffer.from(`${process.env.GOWA_USERNAME}:${process.env.GOWA_PASSWORD}`).toString('base64')}`,
                        'X-Device-Id': device_id || process.env.GOWA_DEVICE_ID
                    };
                    if (process.env.GOWA_TRAEFIK_HOST) {
                        headers['Host'] = process.env.GOWA_TRAEFIK_HOST;
                    }
                    
                    await fetch(`${gowaUrl}/send/message`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ phone, message: response })
                    });
                }
            } catch (aiErr) {
                console.error('AI WhatsApp response failed:', aiErr);
            }
        }
    }

    res.status(200).send('OK');
  });

  app.get('/api/whatsapp/connect', async (req, res) => {
    const gowaUrl = process.env.GOWA_API_URL;
    if (!gowaUrl) return res.status(530).json({ error: 'GoWA API not configured' });
    const webhookUrl = process.env.GOWA_WEBHOOK_URL;
    const webhookSecret = process.env.GOWA_WEBHOOK_SECRET || 'secret';
    
    try {
      const gowaAuth = Buffer.from(`${process.env.GOWA_USERNAME}:${process.env.GOWA_PASSWORD}`).toString('base64');
      const headers: any = {
        'Authorization': `Basic ${gowaAuth}`,
        'Content-Type': 'application/json'
      };
      if (process.env.GOWA_TRAEFIK_HOST) {
        headers['Host'] = process.env.GOWA_TRAEFIK_HOST;
      }

      // 1. Register Webhook if configured
      if (webhookUrl) {
         try {
             await fetch(`${gowaUrl}/app/webhook`, {
                 method: 'POST',
                 headers,
                 body: JSON.stringify({ url: webhookUrl, secret: webhookSecret })
             });
             console.log(`Registered WhatsApp webhook: ${webhookUrl}`);
         } catch (whErr) {
             console.warn('Failed to register WhatsApp webhook:', whErr);
         }
      }

      // 2. Get or create device
      let deviceId = process.env.GOWA_DEVICE_ID || '';
      
      if (!deviceId) {
          const devicesRes = await fetch(`${gowaUrl}/devices`, { headers });
          if (!devicesRes.ok) {
              const errText = await devicesRes.text();
              console.error('GoWA Devices Fetch Error:', errText);
              return res.status(devicesRes.status).json({ error: 'Failed to fetch WhatsApp devices', details: errText });
          }
          const devicesData = await devicesRes.json();
          
          if (devicesData && devicesData.results && devicesData.results.length > 0) {
              deviceId = devicesData.results[0].id;
          } else {
              // Create device
              const createRes = await fetch(`${gowaUrl}/devices`, { method: 'POST', headers });
              if (!createRes.ok) {
                const errText = await createRes.text();
                return res.status(createRes.status).json({ error: 'Failed to create WhatsApp device instance', details: errText });
              }
              const createData = await createRes.json();
              if (createData.results && createData.results.id) {
                  deviceId = createData.results.id;
              } else {
                  return res.status(500).json({ error: 'Failed to create WhatsApp device instance.', details: createData });
              }
          }
      }

      headers['X-Device-Id'] = deviceId;
      
      // 3. Get login QR
      const loginRes = await fetch(`${gowaUrl}/app/login`, { headers });
      if (!loginRes.ok) {
          const errText = await loginRes.text();
          console.error('GoWA Login Fetch Error:', errText);
          
          // Try /devices/{id} which might have the QR or state
          const deviceDetailRes = await fetch(`${gowaUrl}/devices/${deviceId}`, { headers });
          if (deviceDetailRes.ok) {
              const detailData = await deviceDetailRes.json();
              if (detailData.results && detailData.results.qr_link) {
                  return res.json({
                    data: { qr: detailData.results.qr_link },
                    raw_response: detailData
                  });
              }
              // If already authenticated
              if (detailData.results && (detailData.results.state === 'AUTHENTICATED' || detailData.results.state === 'authenticated')) {
                  return res.json({
                      data: { authenticated: true },
                      raw_response: detailData
                  });
              }
          }
          return res.status(loginRes.status).json({ error: 'GoWA Login failed', details: errText });
      }
      const loginData = await loginRes.json();
      
      let qrUrl = '';
      if (loginData.results && loginData.results.qr_link) {
          qrUrl = loginData.results.qr_link;
          if (gowaUrl.startsWith('https://')) {
              qrUrl = qrUrl.replace('http://', 'https://');
          }
      }
      
      res.json({
          data: { qr: qrUrl || undefined }, 
          raw_response: loginData
      });
    } catch (e: any) {
      console.error('WhatsApp Connect Exception:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/whatsapp/messages', authenticateToken, async (req: any, res) => {
    const gowaUrl = process.env.GOWA_API_URL;
    if (!gowaUrl) return res.status(503).json({ error: 'GoWA API not configured' });
    
    try {
      const gowaHeaders: any = {
        'Authorization': `Basic ${Buffer.from(`${process.env.GOWA_USERNAME}:${process.env.GOWA_PASSWORD}`).toString('base64')}`,
        'Content-Type': 'application/json'
      };
      if (process.env.GOWA_TRAEFIK_HOST) {
        gowaHeaders['Host'] = process.env.GOWA_TRAEFIK_HOST;
      }

      // Get device ID
      let deviceId = process.env.GOWA_DEVICE_ID || '';
      if (!deviceId) {
          let devicesRes = await fetch(`${gowaUrl}/devices`, { headers: gowaHeaders });
          let devicesData = await devicesRes.json();
          if (!devicesData.results || devicesData.results.length === 0) {
              return res.status(400).json({ error: 'No WhatsApp device configured.' });
          }
          deviceId = devicesData.results[0].id;
      }
      gowaHeaders['X-Device-Id'] = deviceId;

      // Fetch chats from GoWA
      const limitVal = parseInt(req.query.limit as string) || 10;
      const response = await fetch(`${gowaUrl}/chats?limit=${limitVal}`, { headers: gowaHeaders });
      const result = await response.json();
      
      const chats = result.results?.data || [];
      res.json({ success: true, messages: chats });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/whatsapp/send', authenticateToken, async (req: any, res) => {
    const gowaUrl = process.env.GOWA_API_URL;
    if (!gowaUrl) return res.status(503).json({ error: 'GoWA API not configured' });
    
    try {
      const headers: any = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.GOWA_USERNAME}:${process.env.GOWA_PASSWORD}`).toString('base64')}`
      };
      if (process.env.GOWA_TRAEFIK_HOST) {
        headers['Host'] = process.env.GOWA_TRAEFIK_HOST;
      }

      // Get device ID
      let deviceId = process.env.GOWA_DEVICE_ID || '';
      if (!deviceId) {
          let devicesRes = await fetch(`${gowaUrl}/devices`, { headers });
          let devicesData = await devicesRes.json();
          if (!devicesData.results || devicesData.results.length === 0) {
              return res.status(400).json({ error: 'No WhatsApp device configured. Please connect first.' });
          }
          deviceId = devicesData.results[0].id;
      }
      headers['X-Device-Id'] = deviceId;

      const response = await fetch(`${gowaUrl}/send/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: req.body.phone,
          message: req.body.text
        })
      });
      const result = await response.json();

      // Log to Firestore
      try {
        const firestore = getFirebaseAdmin().firestore();
        await firestore.collection('users').doc(req.user.uid).collection('whatsapp_messages').add({
          phone: req.body.phone,
          text: req.body.text,
          direction: 'sent',
          status: result.status || 'success',
          timestamp: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('Failed to log WhatsApp message to Firestore:', logErr);
      }

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_PATH));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(DIST_PATH, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Eburon AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
