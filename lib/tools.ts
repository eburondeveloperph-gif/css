/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionResponseScheduling } from '@google/genai';
import { FunctionCall, workspaceTools } from './state';
import { personalAssistantTools } from './tools/personal-assistant';
import { whatsappTools } from './tools/whatsapp';
import { documentTools } from './tools/document-generator';

export const AVAILABLE_TOOLS: FunctionCall[] = [
  ...personalAssistantTools,
  ...workspaceTools,
  ...whatsappTools,
  ...documentTools
];
