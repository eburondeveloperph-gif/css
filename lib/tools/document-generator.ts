import { FunctionCall } from '../state';

export const documentTools: FunctionCall[] = [
  {
    name: 'generate_eburon_document',
    description: 'Generates a branded Eburon AI HTML document (Invoice, Quotation, Contract, etc.) based on provided data.',
    parameters: {
      type: 'object',
      properties: {
        docId: {
          type: 'string',
          description: 'The type of document to generate',
          enum: [
            'letterhead', 'invoice', 'quotation', 'business-letter', 
            'service-policy', 'terms', 'privacy', 'gdpr', 
            'service-agreement', 'employment', 'nda', 'freelancer'
          ]
        },
        data: {
          type: 'object',
          description: 'The data to populate the document fields',
          properties: {
            recipient_name: { type: 'string' },
            recipient_company: { type: 'string' },
            recipient_address: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
            client_company: { type: 'string' },
            client_vat: { type: 'string' },
            client_address: { type: 'string' },
            invoice_no: { type: 'string' },
            quote_no: { type: 'string' },
            item_1: { type: 'string' },
            qty_1: { type: 'string' },
            rate_1: { type: 'string' },
            fee: { type: 'string' },
            scope: { type: 'string' },
            deliverables: { type: 'string' },
            effective_date: { type: 'string' },
            due_date: { type: 'string' },
            signed_date: { type: 'string' }
          }
        }
      },
      required: ['docId', 'data']
    }
  }
];
