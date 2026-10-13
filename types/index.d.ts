export type Pin = { url: string; label: string }

declare module 'claude-code' {
  interface PluginState {
    pins: { pins: Pin[] }
  }
}
