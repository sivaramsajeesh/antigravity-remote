/**
 * Antigravity Remote Control - TypeScript Type Definitions
 *
 * Core type definitions used across the mobile app for messages,
 * WebSocket communication, connection state, and app settings.
 */

// ---------------------------------------------------------------------------
// Chat Messages
// ---------------------------------------------------------------------------

/** A single chat message in the conversation */
export interface Message {
  /** Unique identifier for the message */
  id: string;
  /** Who sent this message */
  role: 'user' | 'assistant' | 'system';
  /** The text content of the message (may contain markdown for assistant) */
  content: string;
  /** ISO-8601 timestamp when the message was created */
  timestamp: string;
  /** True while the assistant is still streaming this message */
  isStreaming?: boolean;
}

// ---------------------------------------------------------------------------
// WebSocket Protocol
// ---------------------------------------------------------------------------

/** Outbound message: user sends a chat prompt */
export interface WsSendMessage {
  type: 'message' | 'chat';
  content: string;
}

/** Outbound message: client keep-alive ping */
export interface WsPing {
  type: 'ping';
}

/** Inbound: server connection ack */
export interface WsConnected {
  type: 'connected';
  message: string;
}

/** Inbound: agent status update */
export interface WsStatus {
  type: 'status';
  agent_active: boolean;
}

/** Inbound: agent response starting */
export interface WsResponseStart {
  type: 'response_start';
}

/** Inbound: streamed token delta */
export interface WsToken {
  type: 'token';
  content: string;
}

/** Inbound: agent response completed */
export interface WsResponseEnd {
  type: 'response_end';
  full_response: string;
}

/** Inbound: server pong response */
export interface WsPong {
  type: 'pong';
}

/** Inbound: error from server */
export interface WsError {
  type: 'error';
  message: string;
}

/** Union of every possible inbound WebSocket message */
export type WebSocketMessageInbound =
  | WsConnected
  | WsStatus
  | WsResponseStart
  | WsToken
  | WsResponseEnd
  | WsPong
  | WsError;

/** Union of every possible outbound WebSocket message */
export type WebSocketMessageOutbound =
  | WsSendMessage
  | WsPing;

/** Convenience union of all WebSocket message types */
export type WebSocketMessage =
  | WebSocketMessageInbound
  | WebSocketMessageOutbound;

// ---------------------------------------------------------------------------
// Connection State
// ---------------------------------------------------------------------------

/** Current state of the WebSocket connection */
export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

// ---------------------------------------------------------------------------
// App Settings
// ---------------------------------------------------------------------------

/** Persisted user settings */
export interface AppSettings {
  /** IP or hostname of the Antigravity backend server */
  serverHost: string;
  /** WebSocket port of the backend server */
  serverPort: string;
}
