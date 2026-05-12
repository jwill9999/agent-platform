import type { AgentPlatformDesktopApi } from './desktopBridge.js';

declare global {
  interface Window {
    agentPlatformDesktop: AgentPlatformDesktopApi;
  }
}

export {};
