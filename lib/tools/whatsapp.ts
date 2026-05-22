import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const whatsappTools: FunctionCall[] = [
  {
    name: 'send_whatsapp_message',
    description: 'Sends a WhatsApp message to a specific phone number using the official Meta WhatsApp Cloud API.',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'The phone number of the recipient (e.g., "5511999999999").',
        },
        text: {
          type: 'string',
          description: 'The content of the message to send.',
        },
      },
      required: ['phone', 'text'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'connect_whatsapp',
    description: 'Ensures the WhatsApp service is connected and ready to send messages.',
    parameters: {
      type: 'object',
      properties: {},
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'list_whatsapp_messages',
    description: 'Retrieves a list of recent WhatsApp messages from the connected device.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'The maximum number of messages to retrieve (e.g. 10).',
        }
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  }
];
