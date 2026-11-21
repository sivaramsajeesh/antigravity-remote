/**
 * app.js – Antigravity Remote Control web-dashboard client.
 *
 * Handles:
 *   • WebSocket connection with exponential-backoff auto-reconnect
 *   • Real-time token streaming into the chat view
 *   • Simple markdown → HTML rendering
 *   • Conversation history fetch on reconnect
 */

// ===========================================================================
// DOM references
// ===========================================================================
const chatEl          = document.getElementById('chat');
const inputEl         = document.getElementById('msg-input');
const sendBtn         = document.getElementById('send-btn');
const statusDot       = document.getElementById('status-dot');
const statusLabel     = document.getElementById('status-label');
const agentLabel      = document.getElementById('agent-label');
const typingIndicator = document.getElementById('typing-indicator');

// ===========================================================================
// State
// ===========================================================================
let ws                = null;
let reconnectDelay    = 500;        // ms – doubles on each failure (max 30 s)
const MAX_DELAY       = 30000;
let currentBubble     = null;       // the assistant bubble being streamed into
let isStreaming        = false;

// ===========================================================================
// Simple Markdown → HTML
// ===========================================================================

/**
 * Convert a subset of Markdown to HTML.
 * Supports: fenced code blocks, inline code, bold, italic.
 */
function markdownToHtml(text) {
  // Escape HTML entities first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Fenced code blocks  ```lang\n…\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code  `…`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold  **…**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic  *…*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

// ===========================================================================
// Chat rendering helpers
// ===========================================================================

/** Scroll the chat container to the bottom. */
function scrollToBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

/**
 * Append a fully-formed message bubble.
 * @param {'user'|'assistant'} role
 * @param {string} content  – raw text (will be rendered as markdown)
 */
function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message message--${role}`;
  div.innerHTML = markdownToHtml(content);
  chatEl.appendChild(div);
  scrollToBottom();
  return div;
}

/** Start a new empty assistant bubble for streaming. */
function startAssistantBubble() {
  const div = document.createElement('div');
  div.className = 'message message--assistant';
  div.textContent = '';
  chatEl.appendChild(div);
  scrollToBottom();
  return div;
}

// ===========================================================================
// WebSocket
// ===========================================================================

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${location.host}/ws`;

  ws = new WebSocket(url);

  // -- open ----------------------------------------------------------------
  ws.addEventListener('open', () => {
    console.log('[ws] connected');
    reconnectDelay = 500;                       // reset backoff
    setConnectionStatus(true);
    fetchHistory();                             // catch up on past messages
  });

  // -- message -------------------------------------------------------------
  ws.addEventListener('message', (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      console.warn('[ws] non-JSON message', event.data);
      return;
    }
    handleServerEvent(data);
  });

  // -- close / error -------------------------------------------------------
  ws.addEventListener('close', () => {
    console.warn('[ws] disconnected');
    setConnectionStatus(false);
    scheduleReconnect();
  });

  ws.addEventListener('error', (err) => {
    console.error('[ws] error', err);
    ws.close();
  });
}

/** Exponential-backoff reconnect. */
function scheduleReconnect() {
  setTimeout(() => {
    console.log(`[ws] reconnecting in ${reconnectDelay}ms …`);
    connect();
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  }, reconnectDelay);
}

// ===========================================================================
// Server event dispatcher
// ===========================================================================

function handleServerEvent(data) {
  switch (data.type) {
    case 'connected':
      console.log('[server]', data.message);
      break;

    case 'status':
      setAgentStatus(data.agent_active);
      break;

    case 'response_start':
      isStreaming = true;
      currentBubble = startAssistantBubble();
      showTyping(true);
      break;

    case 'token':
      if (currentBubble) {
        // Append raw text; we'll convert to HTML on response_end
        currentBubble._rawText = (currentBubble._rawText || '') + data.content;
        currentBubble.innerHTML = markdownToHtml(currentBubble._rawText);
        scrollToBottom();
      }
      break;

    case 'response_end':
      showTyping(false);
      if (currentBubble) {
        // Final render with the full response
        currentBubble.innerHTML = markdownToHtml(data.full_response);
        scrollToBottom();
      }
      currentBubble = null;
      isStreaming = false;
      break;

    case 'error':
      console.error('[server] error:', data.message);
      showTyping(false);
      addSystemNote(`Error: ${data.message}`);
      isStreaming = false;
      currentBubble = null;
      break;

    default:
      console.log('[server] unknown event', data);
  }
}

// ===========================================================================
// History fetch
// ===========================================================================

async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    const { history } = await res.json();
    if (!history || history.length === 0) return;

    // Clear chat and re-render
    chatEl.innerHTML = '';
    history.forEach(({ role, content }) => addMessage(role, content));
  } catch (err) {
    console.warn('[history] could not fetch', err);
  }
}

// ===========================================================================
// UI helpers
// ===========================================================================

function setConnectionStatus(connected) {
  if (connected) {
    statusDot.classList.add('connected');
    statusLabel.textContent = 'Connected';
  } else {
    statusDot.classList.remove('connected');
    statusLabel.textContent = 'Disconnected';
  }
}

function setAgentStatus(active) {
  agentLabel.textContent = active ? 'Agent Active' : 'Agent Inactive';
  agentLabel.style.color  = active ? 'var(--success)' : 'var(--danger)';
}

function showTyping(visible) {
  typingIndicator.classList.toggle('visible', visible);
  if (visible) scrollToBottom();
}

function addSystemNote(text) {
  const div = document.createElement('div');
  div.className = 'message message--assistant';
  div.style.borderColor = 'var(--danger)';
  div.textContent = text;
  chatEl.appendChild(div);
  scrollToBottom();
}

// ===========================================================================
// Sending messages
// ===========================================================================

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

  addMessage('user', text);
  ws.send(JSON.stringify({ type: 'message', content: text }));
  inputEl.value = '';
  inputEl.focus();
}

// Enter key sends (Shift+Enter inserts newline – but we use an <input>)
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

// ===========================================================================
// Boot
// ===========================================================================
connect();
