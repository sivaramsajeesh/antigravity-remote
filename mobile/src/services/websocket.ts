/**
 * Antigravity Remote Control - WebSocket Service
 *
 * Singleton WebSocket client that manages:
 *  • Connection lifecycle (connect / disconnect)
 *  • Auto-reconnect with exponential back-off (1 → 2 → 4 → 8 → … → 30 s)
 *  • Ping / pong keep-alive
 *  • Event-based callbacks for message, connect, disconnect, error
 */

import {
  ConnectionStatus,
  WebSocketMessageInbound,
  WebSocketMessageOutbound,
} from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Starting delay (ms) before the first reconnect attempt */
const INITIAL_RECONNECT_DELAY = 1_000;
/** Upper cap (ms) for the exponential back-off */
const MAX_RECONNECT_DELAY = 30_000;
/** Interval (ms) between keep-alive pings */
const PING_INTERVAL = 25_000;
/** How long (ms) to wait for a pong before considering the link dead */
const PONG_TIMEOUT = 10_000;

// ---------------------------------------------------------------------------
// WebSocket Service
// ---------------------------------------------------------------------------

export class WebSocketService {
  // ---- Singleton ----
  private static instance: WebSocketService | null = null;

  /** Get (or create) the singleton instance */
  static getInstance(url?: string): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(url ?? '');
    }
    return WebSocketService.instance;
  }

  /** Replace the singleton with a fresh instance pointing at a new URL */
  static resetInstance(url: string): WebSocketService {
    if (WebSocketService.instance) {
      WebSocketService.instance.disconnect();
    }
    WebSocketService.instance = new WebSocketService(url);
    return WebSocketService.instance;
  }

  // ---- Connection state ----
  private url: string;
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';

  // ---- Reconnect state ----
  private reconnectDelay = INITIAL_RECONNECT_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  // ---- Keep-alive state ----
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingPong = false;

  // ---- Event callbacks ----
  public onMessage: ((msg: WebSocketMessageInbound) => void) | null = null;
  public onConnect: (() => void) | null = null;
  public onDisconnect: (() => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onStatusChange: ((status: ConnectionStatus) => void) | null = null;

  // ---- Constructor (private for singleton) ----
  private constructor(url: string) {
    this.url = url;
  }

  // -----------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------

  /** Update the target URL without connecting */
  setUrl(url: string): void {
    this.url = url;
  }

  /** Current connection status */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Open the WebSocket connection */
  connect(): void {
    // Don't double-connect
    if (this.ws && (this.status === 'connected' || this.status === 'connecting')) {
      return;
    }

    if (!this.url) {
      this.setStatus('error');
      this.onError?.('No server URL configured');
      return;
    }

    this.shouldReconnect = true;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = this.handleOpen;
      this.ws.onmessage = this.handleMessage;
      this.ws.onerror = this.handleError;
      this.ws.onclose = this.handleClose;
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      this.setStatus('error');
      this.onError?.(`Connection failed: ${String(err)}`);
      this.scheduleReconnect();
    }
  }

  /** Gracefully close the connection (no auto-reconnect) */
  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopKeepAlive();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setStatus('disconnected');
    this.onDisconnect?.();
  }

  /** Send a typed message to the server */
  send(message: WebSocketMessageOutbound): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send – socket not open');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('[WS] Send error:', err);
      return false;
    }
  }

  // -----------------------------------------------------------------
  // Internal handlers (arrow functions for `this` binding)
  // -----------------------------------------------------------------

  private handleOpen = (): void => {
    console.log('[WS] Connected to', this.url);
    this.reconnectDelay = INITIAL_RECONNECT_DELAY; // reset back-off
    this.setStatus('connected');
    this.startKeepAlive();
    this.onConnect?.();
  };

  private handleMessage = (event: WebSocketMessageEvent): void => {
    try {
      const data = JSON.parse(event.data as string) as WebSocketMessageInbound;

      // Handle pong internally
      if (data.type === 'pong') {
        this.awaitingPong = false;
        this.clearPongTimer();
        return;
      }

      this.onMessage?.(data);
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  };

  private handleError = (event: Event): void => {
    console.error('[WS] Error:', event);
    this.setStatus('error');
    this.onError?.('WebSocket error');
  };

  private handleClose = (event: WebSocketCloseEvent): void => {
    console.log('[WS] Closed – code:', event.code, 'reason:', event.reason);
    this.ws = null;
    this.stopKeepAlive();

    if (this.status !== 'disconnected') {
      this.setStatus('disconnected');
      this.onDisconnect?.();
    }

    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }
  };

  // -----------------------------------------------------------------
  // Reconnect logic (exponential back-off)
  // -----------------------------------------------------------------

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    this.clearReconnectTimer();

    console.log(`[WS] Reconnecting in ${this.reconnectDelay / 1000}s…`);
    this.setStatus('connecting');

    this.reconnectTimer = setTimeout(() => {
      this.connect();
      // Double the delay for next attempt, up to the max
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        MAX_RECONNECT_DELAY,
      );
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -----------------------------------------------------------------
  // Keep-alive (ping / pong)
  // -----------------------------------------------------------------

  private startKeepAlive(): void {
    this.stopKeepAlive();

    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.awaitingPong = true;
        this.send({ type: 'ping' });

        // Start a deadline for the pong response
        this.pongTimer = setTimeout(() => {
          if (this.awaitingPong) {
            console.warn('[WS] Pong timeout – connection may be dead');
            this.ws?.close(4000, 'Pong timeout');
          }
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  private stopKeepAlive(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimer();
    this.awaitingPong = false;
  }

  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  // -----------------------------------------------------------------
  // Status helpers
  // -----------------------------------------------------------------

  private setStatus(next: ConnectionStatus): void {
    if (next !== this.status) {
      this.status = next;
      this.onStatusChange?.(next);
    }
  }
}
