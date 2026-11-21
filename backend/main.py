"""
main.py – FastAPI server for the Antigravity Remote Control app.

• WebSocket endpoint at /ws for real-time bi-directional chat
• REST endpoints for status, history, and agent lifecycle
• Serves the static web dashboard from ./static
• Auto-starts the Antigravity agent on application startup
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Set

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from agent_manager import AgentManager

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv()

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8765"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

# Active WebSocket connections
active_connections: Set[WebSocket] = set()

# Singleton agent manager
agent_manager = AgentManager()


# ---------------------------------------------------------------------------
# Broadcasting helper
# ---------------------------------------------------------------------------

async def broadcast(event: dict[str, Any]) -> None:
    """Send a JSON event to every connected WebSocket client."""
    payload = json.dumps(event)
    stale: list[WebSocket] = []

    for ws in active_connections:
        try:
            await ws.send_text(payload)
        except Exception:
            stale.append(ws)

    # Clean up broken connections
    for ws in stale:
        active_connections.discard(ws)


# Wire the broadcast function into the agent manager so streamed tokens
# are pushed to all clients automatically.
agent_manager.set_broadcast(broadcast)


# ---------------------------------------------------------------------------
# Application lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: auto-start the agent.  Shutdown: stop it cleanly."""
    logger.info("Application starting – launching Antigravity agent …")
    try:
        await agent_manager.start_agent()
    except Exception:
        logger.warning("Agent failed to auto-start; it can be started manually via POST /api/agent/start")
    yield
    logger.info("Application shutting down – stopping agent …")
    await agent_manager.stop_agent()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Antigravity Remote Control",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow everything for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """Real-time chat channel.

    Client → Server  JSON messages:
        {"type": "message", "content": "user prompt text"}

    Server → Client  JSON events:
        {"type": "connected", "message": "..."}
        {"type": "token", "content": "..."}
        {"type": "response_start"}
        {"type": "response_end", "full_response": "..."}
        {"type": "error", "message": "..."}
        {"type": "status", "agent_active": true/false}
    """
    await ws.accept()
    active_connections.add(ws)
    logger.info("WebSocket client connected  (total: %d)", len(active_connections))

    # Greet the new client
    try:
        await ws.send_text(json.dumps({
            "type": "connected",
            "message": "Connected to Antigravity Remote Control",
        }))
        await ws.send_text(json.dumps({
            "type": "status",
            "agent_active": agent_manager.is_active,
        }))
    except Exception:
        active_connections.discard(ws)
        return

    # Main receive loop
    try:
        while True:
            raw = await ws.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON",
                }))
                continue

            msg_type = data.get("type")

            if msg_type in ("message", "chat"):
                content = data.get("content", "").strip()
                if not content:
                    continue

                # Process the user prompt asynchronously
                try:
                    await agent_manager.send_message(content)
                except RuntimeError as exc:
                    await broadcast({
                        "type": "error",
                        "message": str(exc),
                    })
                except Exception as exc:
                    logger.exception("Unhandled error in send_message")
                    await broadcast({
                        "type": "error",
                        "message": f"Internal error: {exc}",
                    })
            elif msg_type == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
            else:
                await ws.send_text(json.dumps({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}",
                }))

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception:
        logger.exception("WebSocket error")
    finally:
        active_connections.discard(ws)
        logger.info("WebSocket clients remaining: %d", len(active_connections))


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/api/status")
async def get_status():
    """Return current agent status and connection count."""
    return JSONResponse({
        "agent_active": agent_manager.is_active,
        "status_message": agent_manager.status_message,
        "connections": len(active_connections),
    })


@app.get("/api/history")
async def get_history():
    """Return the full conversation history."""
    return JSONResponse({"history": agent_manager.history})


@app.post("/api/agent/start")
async def start_agent():
    """Manually start the Antigravity agent."""
    try:
        await agent_manager.start_agent()
        await broadcast({"type": "status", "agent_active": True})
        return JSONResponse({"status": "Agent started"})
    except Exception as exc:
        return JSONResponse(
            {"status": "error", "message": str(exc)},
            status_code=500,
        )


@app.post("/api/agent/stop")
async def stop_agent():
    """Manually stop the Antigravity agent."""
    try:
        await agent_manager.stop_agent()
        await broadcast({"type": "status", "agent_active": False})
        return JSONResponse({"status": "Agent stopped"})
    except Exception as exc:
        return JSONResponse(
            {"status": "error", "message": str(exc)},
            status_code=500,
        )


# ---------------------------------------------------------------------------
# Static files – served LAST so API routes take priority
# ---------------------------------------------------------------------------

app.mount("/", StaticFiles(directory="static", html=True), name="static")


# ---------------------------------------------------------------------------
# Dev entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=True,
        log_level="info",
    )
