// Thin WebSocket client for online play.
import { SERVER_URL } from '../config.js';

// The Android app (Capacitor) has no game server of its own, so it uses SERVER_URL.
function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export function serverUrl(override) {
  const base = (override || (isNativeApp() || location.protocol === 'file:' ? SERVER_URL : '') || '').trim();
  if (base) {
    const u = base.replace(/^http/, 'ws');
    return /^wss?:\/\//.test(u) ? u : 'wss://' + u;
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export class Net {
  constructor(url, handlers) {
    this.handlers = handlers;
    this.closedByUs = false;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => handlers.open && handlers.open();
    this.ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      handlers.message && handlers.message(msg);
    };
    this.ws.onclose = () => { if (!this.closedByUs) handlers.close && handlers.close(); };
    this.ws.onerror = () => {};
  }

  send(msg) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.closedByUs = true;
    try { this.ws.close(); } catch { /* ignore */ }
  }
}
