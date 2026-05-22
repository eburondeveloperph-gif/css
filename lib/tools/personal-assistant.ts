/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const personalAssistantTools: FunctionCall[] = [
  {
    name: 'create_calendar_event',
    description: 'Creates a new event in the user\'s calendar.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'The title or summary of the event.',
        },
        location: {
          type: 'string',
          description: 'The location of the event.',
        },
        startTime: {
          type: 'string',
          description: 'The start time of the event in ISO 8601 format.',
        },
        endTime: {
          type: 'string',
          description: 'The end time of the event in ISO 8601 format.',
        },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'send_email',
    description: 'Sends an email to a specified recipient.',
    parameters: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'The email address of the recipient.',
        },
        subject: {
          type: 'string',
          description: 'The subject line of the email.',
        },
        body: {
          type: 'string',
          description: 'The body content of the email.',
        },
      },
      required: ['recipient', 'subject', 'body'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
  {
    name: 'set_reminder',
    description: 'Sets a reminder for the user.',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task for the reminder.',
        },
        time: {
          type: 'string',
          description: 'The time for the reminder in ISO 8601 format.',
        },
      },
      required: ['task', 'time'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
];
