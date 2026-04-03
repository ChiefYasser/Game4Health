# iHealthPass / NeuroPhobia VR — Backend

Real-time backend for a health + VR game system. Receives ECG sensor data, computes stress scores, syncs with the game via WebSocket, and generates AI-powered session reports.

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose
- Socket.io (WebSocket)
- Google Gemini AI (session insights)

## Setup

```bash
cd backend
npm install
```

Create a `.env` file (see `.env.example`):

```env
PORT=3000
MONGODB_URI=mongodb+srv://your-connection-string
GEMINI_API_KEY=your-gemini-api-key
NODE_ENV=development
```

## Run

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

Server starts at `http://localhost:3000`

## REST API Endpoints

### Health Check
```
GET /api/health
```

### Sessions
```
POST /api/sessions
Body: { "playerName": "Ahmed", "difficulty": "medium" }
Response: { "sessionId": "...", "status": "created" }

GET /api/sessions/:id
```

### Questionnaire
```
POST /api/questionnaires/:sessionId
Body: {
  "age": 22,
  "gender": "male",
  "priorGamingExperience": "casual",
  "currentMood": "neutral",
  "phobiaLevel": 6,
  "notes": ""
}
```

### Reports
```
GET /api/reports/:sessionId
→ Generates final report with stats + Gemini AI insight
```

### Debug / Simulation (for demo without sensor)

```
POST /api/debug/start-calibration
Body: { "sessionId": "..." }

POST /api/debug/simulate-sensor
Body: { "sessionId": "...", "heartRate": 72, "rawValue": 512 }

POST /api/debug/simulate-game-event
Body: { "sessionId": "...", "eventType": "enemy_encounter", "data": { "enemy": "spider" } }
```

## WebSocket (Socket.io)

Two namespaces: `/sensor` and `/game`

### Sensor Connection (namespace: `/sensor`)

```js
import { io } from "socket.io-client";

const sensor = io("http://localhost:3000/sensor");

// Join a session
sensor.emit("join-session", { sessionId: "SESSION_ID" });

// Send ECG data (call repeatedly as sensor reads)
sensor.emit("ecg-data", { heartRate: 75, rawValue: 520 });

// Listen for events
sensor.on("joined", (data) => console.log(data));
sensor.on("calibration-progress", (data) => console.log(data));
// → { readings: 5, needed: 10 }
sensor.on("calibration-complete", (data) => console.log(data));
// → { baselineHR: 72 }
sensor.on("stress-update", (data) => console.log(data));
// → { sessionId, heartRate, stressScore, difficulty, timestamp }
```

### Game Connection (namespace: `/game`)

```js
import { io } from "socket.io-client";

const game = io("http://localhost:3000/game");

// Join a session
game.emit("join-session", { sessionId: "SESSION_ID" });

// Send game events (markers)
game.emit("game-event", {
  eventType: "enemy_encounter",
  data: { enemy: "spider", level: 2 }
});

// End session and get report
game.emit("end-session");

// Listen for events
game.on("joined", (data) => console.log(data));
game.on("calibration-complete", (data) => console.log(data));
game.on("stress-update", (data) => console.log(data));
// → { sessionId, heartRate, stressScore, difficulty, timestamp }
game.on("session-report", (report) => console.log(report));
game.on("event-saved", (data) => console.log(data));
```

## Session Flow

1. **Create session** → `POST /api/sessions`
2. **Submit questionnaire** → `POST /api/questionnaires/:sessionId`
3. **Connect sensor** → Socket.io `/sensor` namespace → `join-session`
4. **Connect game** → Socket.io `/game` namespace → `join-session`
5. **Start calibration** → `POST /api/debug/start-calibration` (or via game)
6. **Stream ECG data** → sensor emits `ecg-data` (10 readings = calibration done)
7. **Play game** → sensor keeps streaming, game sends `game-event` markers
8. **Stress updates** → backend computes and pushes `stress-update` to game in real-time
9. **End session** → game emits `end-session` → receives `session-report`
10. **View report** → `GET /api/reports/:sessionId`

## Stress Score Logic

- During **calibration**: 10 heart rate readings are averaged to get a baseline HR
- During **active play**: stress = `((currentHR - baselineHR) / 30) * 100`, clamped to 0–100
- Difficulty mapping: `<30 = easy`, `30–65 = medium`, `>65 = hard`

## Game Event Types (suggested)

| Event | Description |
|-------|-------------|
| `enemy_encounter` | Player meets an enemy/phobia trigger |
| `jump_scare` | Sudden scare event |
| `puzzle_start` | Player begins a puzzle |
| `puzzle_complete` | Player solves a puzzle |
| `level_change` | Player moves to a new level |
| `player_death` | Player dies in game |
| `safe_zone` | Player enters a calm area |
| `game_over` | Game session ends |

## Folder Structure

```
backend/
├── src/
│   ├── config/         # DB + env config
│   ├── models/         # Mongoose schemas
│   ├── routes/         # REST endpoints
│   ├── services/       # Business logic
│   └── websocket/      # Socket.io handlers
├── server.js           # Entry point
├── .env
└── package.json
```
