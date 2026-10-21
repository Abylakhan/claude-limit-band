export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'limit-band': { limits: Limit[]; billingDay: number | null; now: number }
  }
}
