# 🚀 Antigravity Remote

> Control [Google Antigravity](https://antigravity.google) from your phone — send commands, get real-time streaming responses, and see output on both your mobile and laptop.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)

## 📱 What is this?

Antigravity Remote is a companion app that lets you interact with the Antigravity AI agent running on your laptop — from anywhere on your local network (or remotely via a tunnel). Think of it as a remote control for your AI coding assistant.

### Features

- 🔄 **Real-time streaming** — See agent responses token-by-token as they're generated
- 📱 **Mobile app** — Native React Native (Expo) app for iOS and Android
- 💻 **Web dashboard** — Browser-based UI on your laptop
- 🔌 **WebSocket** — Low-latency bidirectional communication
- 🤖 **Full agent capabilities** — The agent runs with full tool access on your laptop
- 🌙 **Dark theme** — Beautiful, modern UI designed for extended use
- 📋 **Conversation history** — Persistent chat history across reconnections

## 🏗️ Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────────┐
│  📱 Mobile App  │◄──────────────────►│  💻 Backend Server   │
│  (React Native) │                    │  (FastAPI + Python)  │
└─────────────────┘                    │                      │
                                       │  ┌────────────────┐  │
┌─────────────────┐     WebSocket      │  │  Antigravity   │  │
│  🌐 Web Dashboard│◄────────────────►│  │  SDK Agent     │  │
│  (Browser)      │                    │  └────────────────┘  │
└─────────────────┘                    └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Google Antigravity SDK (`pip install google-antigravity`)

### 1. Start the Backend Server

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The server starts on `http://0.0.0.0:8765` by default. The web dashboard is available at this URL.

### 2. Launch the Mobile App

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone.

### 3. Connect

1. Open the mobile app
2. Go to Settings (⚙️ icon)
3. Enter your laptop's local IP address (e.g., `192.168.1.100`)
4. Port: `8765` (default)
5. Tap **Connect**

## ⚙️ Configuration

### Backend

Set environment variables or create a `.env` file in the `backend/` directory:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8765` | Server port |
| `AGENT_SYSTEM_PROMPT` | (default) | Custom system prompt for the agent |

### Mobile

Configure the server connection in the app's Settings screen, or modify defaults in `src/services/websocket.ts`.

## 🔒 Security Note

This app is designed for **local network use**. The backend server binds to `0.0.0.0` to accept connections from your phone on the same WiFi network. For remote access, consider using a secure tunnel (e.g., Cloudflare Tunnel, ngrok, or Tailscale).

## 📁 Project Structure

```
antigravity-remote/
├── backend/                  # Python FastAPI server
│   ├── main.py              # Server entry point
│   ├── agent_manager.py     # Antigravity SDK integration
│   ├── requirements.txt     # Python dependencies
│   └── static/              # Web dashboard
│       ├── index.html
│       ├── style.css
│       └── app.js
├── mobile/                  # React Native Expo app
│   ├── App.tsx             # App entry point
│   ├── src/
│   │   ├── screens/        # App screens
│   │   ├── components/     # Reusable components
│   │   ├── services/       # WebSocket client
│   │   └── types/          # TypeScript types
│   └── ...
├── README.md
├── .gitignore
└── LICENSE
```

## 🛠️ Development

### Backend Development

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8765
```

### Mobile Development

```bash
cd mobile
npm install
npx expo start --clear
```

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with ❤️ using [Google Antigravity](https://antigravity.google)
