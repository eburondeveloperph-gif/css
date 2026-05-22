/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionResponseScheduling } from '@google/genai';
import { FunctionCall } from '../state';

export const customerSupportTools: FunctionCall[] = [
  {
    name: 'start_return',
    description: 'Starts the return process for an item, collecting necessary details from the user.',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'The ID of the order containing the item to be returned.',
        },
        itemName: {
          type: 'string',
          description: 'The name of the item the user wants to return.',
        },
        reason: {
          type: 'string',
          description: 'The reason the user is returning the item.',
        },
      },
      required: ['orderId', 'itemName', 'reason'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'get_order_status',
    description: 'Provides the current status of a user\'s order, searching by order ID or customer details.',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'The ID of the order to check. Ask for this first.',
        },
        customerName: {
          type: 'string',
          description: 'The name of the customer, if order ID is not available.',
        },
        customerEmail: {
          type: 'string',
          description: 'The email of the customer, if order ID is not available.',
        },
      },
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'speak_to_representative',
    description: 'Escalates the conversation to a human customer support representative.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'A brief summary of the user\'s issue for the representative.',
        },
      },
      required: ['reason'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
];
