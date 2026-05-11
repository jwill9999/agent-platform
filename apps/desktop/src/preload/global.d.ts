import type { AgentPlatformDesktopApi } from './preload.js';

declare global {
  interface Window {
    agentPlatformDesktop: AgentPlatformDesktopApi;
  }
}

export {};
