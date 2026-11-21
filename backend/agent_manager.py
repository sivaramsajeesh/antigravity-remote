"""
agent_manager.py – Wraps the google-antigravity SDK to spawn, chat with,
and manage an Antigravity AI agent.  Streams tokens back through a
broadcast callback so every connected WebSocket client receives them.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Callable, Coroutine, List, Optional

from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ChatMessage:
    """Single message in the conversation history."""
    role: str          # "user" or "assistant"
    content: str


# ---------------------------------------------------------------------------
# AgentManager
# ---------------------------------------------------------------------------

class AgentManager:
    """High-level wrapper around the Antigravity Agent SDK.

    Responsibilities:
      • Spawn / stop the underlying agent
      • Send chat messages and yield streaming tokens
      • Keep an in-memory conversation history
      • Push every token to a broadcast callback (WebSocket fan-out)
    """

    def __init__(self) -> None:
        self._agent: Optional[Agent] = None
        self._active: bool = False
        self._history: List[ChatMessage] = []
        self._lock = asyncio.Lock()

        # Broadcast callback – set by the FastAPI app so tokens are pushed
        # to all connected WebSocket clients.
        self._broadcast: Optional[
            Callable[[dict[str, Any]], Coroutine[Any, Any, None]]
        ] = None

    # -- Properties ---------------------------------------------------------

    @property
    def is_active(self) -> bool:
        """Return whether the agent is currently running."""
        return self._active

    @property
    def history(self) -> List[dict[str, str]]:
        """Return conversation history as a list of plain dicts."""
        return [{"role": m.role, "content": m.content} for m in self._history]

    # -- Broadcast ----------------------------------------------------------

    def set_broadcast(
        self,
        callback: Callable[[dict[str, Any]], Coroutine[Any, Any, None]],
    ) -> None:
        """Register the broadcast coroutine used to push events to clients."""
        self._broadcast = callback

    async def _emit(self, event: dict[str, Any]) -> None:
        """Send an event dict through the broadcast callback, if set."""
        if self._broadcast is not None:
            try:
                await self._broadcast(event)
            except Exception:
                logger.exception("Broadcast callback failed")

    # -- Agent lifecycle ----------------------------------------------------

    async def start_agent(self) -> None:
        """Spawn the Antigravity agent (idempotent – safe to call twice)."""
        async with self._lock:
            if self._active:
                logger.info("Agent already active – skipping start")
                return

            logger.info("Starting Antigravity agent …")
            try:
                config = LocalAgentConfig(
                    capabilities=CapabilitiesConfig(
                        streaming=True,
                    ),
                )
                self._agent = Agent(config=config)
                await self._agent.start()
                self._active = True
                logger.info("Antigravity agent started successfully")
            except Exception:
                logger.exception("Failed to start Antigravity agent")
                self._active = False
                raise

    async def stop_agent(self) -> None:
        """Gracefully shut down the running agent."""
        async with self._lock:
            if not self._active or self._agent is None:
                logger.info("Agent is not active – nothing to stop")
                return

            logger.info("Stopping Antigravity agent …")
            try:
                await self._agent.stop()
            except Exception:
                logger.exception("Error while stopping agent")
            finally:
                self._agent = None
                self._active = False
                logger.info("Antigravity agent stopped")

    # -- Chat ---------------------------------------------------------------

    async def send_message(self, prompt: str) -> str:
        """Send *prompt* to the agent and stream tokens back.

        Each token is emitted via the broadcast callback so all WebSocket
        clients see it in real-time.  Returns the full assembled response
        once the agent finishes.
        """
        if not self._active or self._agent is None:
            raise RuntimeError("Agent is not active – start it first")

        # Record user message
        self._history.append(ChatMessage(role="user", content=prompt))

        # Signal response start
        await self._emit({"type": "response_start"})

        full_response = ""

        try:
            # Stream tokens from the agent
            async for token in self._agent.chat_stream(prompt):
                full_response += token
                await self._emit({"type": "token", "content": token})

        except Exception as exc:
            logger.exception("Error during agent chat")
            await self._emit({"type": "error", "message": str(exc)})
            raise

        # Record assistant response
        self._history.append(ChatMessage(role="assistant", content=full_response))

        # Signal response end with the complete text
        await self._emit({
            "type": "response_end",
            "full_response": full_response,
        })

        return full_response
