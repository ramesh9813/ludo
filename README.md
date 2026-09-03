# game 🎲 — Online Multiplayer Ludo with Live Voice Chat

A modern, backend-less online multiplayer Ludo game featuring real-time state synchronization via Firebase, mesh WebRTC voice chat, 3D physics dice tumbling, adaptive AI companions, and ELO-based matchmaking.

## ✨ Features

- **Real-Time Multiplayer**: 2, 3, or 4 players with real-time board state synchronization powered by Firebase Firestore.
- **Integrated WebRTC Voice Chat**: Peer-to-peer low-latency audio mesh among human players in the room, with mute/unmute controls and active speaking indicator pulse rings on player avatars.
- **Standout 3D Tumbling Dice**: Authentic 3D tumbling cube with realistic physics, smooth cubic-bezier easing, dynamic ambient shadows, and synthesized audio sound effects.
- **Official Standard Ludo Rules**:
  - 4 tokens per player
  - Roll a 6 to exit base yard
  - Rolling a 6 or capturing an opponent awards a bonus turn
  - Triple-six penalty: rolling three consecutive 6s forfeits the turn
  - 8 safe star tiles
  - Exact roll required to reach Home
- **Skill-Based Matchmaking**: Automatic pairing based on ELO ratings (±250 range) with auto-fill AI timeout option.
- **Adaptive AI Bots**: Easy, Medium, and Hard computer players with intelligent path evaluation (prioritizing captures, safety, and reaching home).
- **Glassmorphic Cyber-Ludo Design**: Sleek dark-mode aesthetic with luminous jewel-toned player colors (Ruby Red, Emerald Green, Amber Gold, Sapphire Blue) and responsive layout for mobile and desktop.
- **Zero Custom Backend**: Uses Firebase Firestore for data sync and WebRTC signaling, with zero custom server maintenance required.

## 🛠️ Tech Stack

- **Frontend**: React 18, React Router v6, TypeScript, Tailwind CSS
- **Icons & Animation**: Lucide React, Canvas Confetti, Web Audio API Synthesizer
- **State & Sync**: Firebase Firestore (Realtime snapshots & WebRTC signaling documents)
- **Auth**: Firebase Authentication (Google Sign-In with Guest mode support)
- **Voice Chat**: WebRTC PeerConnection Mesh with AudioContext Volume Analyser
- **Hosting**: Render Static Site via Render CLI

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- Firebase Project configured with Firestore and Authentication

### 2. Environment Setup
Copy `.env.example` to `.env` and fill in your Firebase credentials:
```bash
cp .env.example .env
```

### 3. Installation & Development
```bash
npm install
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

## 📜 License
MIT
