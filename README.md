# Private Chat Server

A private, self-hosted group chat you control. One room, real-time messages, persisted history. The server owner creates accounts — there is no public sign-up.

Four clients talk to the same backend:

| Package    | What it is                          |
| ---------- | ----------------------------------- |
| `server/`  | Bun + Fastify API and WebSocket hub |
| `web/`     | Next.js browser client              |
| `mobile/`  | Expo (React Native) app             |
| `terminal/`| Bun + openTUI terminal client       |

---

## Prerequisites

- **[Bun](https://bun.sh)** — runtime and package manager for every package in this repo
- **A real terminal** — required for the TUI client (IDE embedded terminals often break ANSI rendering)
- **Expo Go** (optional) — for testing the mobile app on a phone

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Quick start (local development)

Each package is independent. Install dependencies once per package, then run them in separate terminals.

### 1. Server

```bash
cd server
bun install
```

Create `server/.env`:

```env
PORT=3001
JWT_SECRET=replace_with_at_least_32_random_characters
DB_PATH=./data/chat.db
```

Generate a secret:

```bash
openssl rand -hex 32
```

Start the server:

```bash
bun run dev    # watch mode
# or
bun run start
```

The API and WebSocket both listen on port **3001** (`/auth/*` for HTTP, `/ws` for WebSocket).

### 2. Create users

Accounts are admin-only. From the `server/` directory:

```bash
bun scripts/admin.js add-user alice secretpass
bun scripts/admin.js add-user bob secretpass
bun scripts/admin.js list-users
```

Other commands: `remove-user <username>`.

### 3. Web client

```bash
cd web
bun install
```

Create `web/.env.local`:

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

### 4. Terminal client

```bash
cd terminal
bun install
```

Optional `terminal/.env` (defaults work for local dev):

```env
SERVER_URL=http://localhost:3001
WS_URL=ws://localhost:3001
```

```bash
bun run start
```

Run this in a system terminal (GNOME Terminal, iTerm2, Windows Terminal, etc.), not inside your IDE.

### 5. Mobile client

```bash
cd mobile
bun install
bun run start
```

Scan the QR code with **Expo Go**.

**Connecting to your dev machine:**

- **Physical device on the same Wi‑Fi** — the app auto-detects your machine’s LAN IP from Metro. Just make sure the server is running and reachable on port 3001.
- **Android emulator** — uses `10.0.2.2:3001` automatically.
- **Custom server URL** — set `mobile/.env`:

  ```env
  EXPO_PUBLIC_SERVER_URL=http://192.168.1.10:3001
  EXPO_PUBLIC_WS_URL=ws://192.168.1.10:3001
  ```

---

## Running everything at once

Open four terminals:

```bash
# Terminal 1 — backend
cd server && bun run dev

# Terminal 2 — web
cd web && bun run dev

# Terminal 3 — TUI
cd terminal && bun run start

# Terminal 4 — mobile
cd mobile && bun run start
```

Log in as different users in two browser tabs to verify real-time delivery.

---

## Environment variables

| Package  | File            | Variables |
| -------- | --------------- | --------- |
| `server` | `.env`          | `PORT`, `JWT_SECRET`, `DB_PATH` |
| `web`    | `.env.local`    | `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_WS_URL` |
| `terminal` | `.env`        | `SERVER_URL`, `WS_URL` |
| `mobile` | `.env`          | `EXPO_PUBLIC_SERVER_URL`, `EXPO_PUBLIC_WS_URL` |

Never commit `.env` files. In production, use `https://` and `wss://` URLs.

---

## Project layout

```
private-chat-server/
├── server/          # API, WebSocket handler, SQLite, admin CLI
├── web/             # Next.js App Router client
├── mobile/          # Expo Router client
├── terminal/        # openTUI client
├── README.md        # This file
└── CONTRIBUTING.md  # How to contribute
```

**Useful scripts**

| Location | Command | Purpose |
| -------- | ------- | ------- |
| `server/` | `bun run dev` | Start API + WebSocket (watch) |
| `server/` | `bun scripts/admin.js …` | Manage users |
| `web/` | `bun run dev` | Next.js dev server |
| `web/` | `bun run build && bun run start` | Production web build |
| `terminal/` | `bun run start` | TUI chat client |
| `mobile/` | `bun run start` | Expo dev server |

---

## Things developers should know

### Authentication flow

1. Client `POST /auth/login` with username + password → receives a JWT (7-day expiry).
2. Client opens WebSocket to `/ws` and sends `{ "type": "auth", "token": "…" }`.
3. Server replies with message history, then streams live messages.

There is no self-registration. Use the admin CLI on the server.

### WebSocket protocol (short version)

**Client → server:** `auth`, `message`  
**Server → client:** `history`, `message`, `system`, `error`

History entries include `id`, `username`, `content`, and `created_at`. Live messages use `from`, `content`, and `ts`.

### Token storage

- **Web** — `localStorage`
- **Mobile** — `expo-secure-store` (encrypted)
- **Terminal** — in memory for the session

### Database

SQLite lives at `server/data/chat.db` (gitignored). Back it up if you care about message history.

### Type checking

```bash
cd server && bunx tsc --noEmit
cd web && bunx tsc --noEmit
cd terminal && bunx tsc --noEmit
cd mobile && bunx tsc --noEmit
```

### Linting

```bash
cd web && bun run lint
cd mobile && bun run lint
```

### Production notes

- Put nginx (or similar) in front of the server with TLS and WebSocket upgrade headers.
- Restrict CORS to your web origin — do not leave `origin: true` in production.
- Run the admin CLI only on the server host; never expose it over HTTP.

### Out of scope (for now)

Multiple rooms, DMs, file uploads, message editing, push notifications, and end-to-end encryption are intentionally not built.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](./LICENSE).
