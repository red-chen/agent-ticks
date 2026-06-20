/// <reference types="vite/client" />

import type { AgentTicksApi } from './types';

declare global {
  interface Window {
    agentTicks?: AgentTicksApi;
  }
}
