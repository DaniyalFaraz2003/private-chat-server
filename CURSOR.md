# CURSOR.md — Private Chat Server: Complete Implementation Guide

> This file is the single source of truth for building the entire project.
> Read it fully before writing a single line of code. Follow the phases in order.
> Every architectural decision is made here — do not improvise alternatives.

---

## Project Overview

A private, self-hosted, real-time group chat system. One chat room. The owner (admin) controls all accounts — users cannot self-register. Authenticated users join the room, see message history from past sessions, and exchange messages in real time. Three client interfaces connect to the same server: a terminal app, a web app, and a mobile app.

**Core requirements:**

- Admin manually creates/deletes user accounts via a CLI script
- Users log in with username + password and receive a JWT
- All three clients connect via WebSocket using that JWT
- Messages are persisted in SQLite and delivered to all connected clients in real time
- Joining clients receive their past message history
- All traffic is encrypted (HTTPS + WSS) in production

---

## Repository Structure

```
chat-root/
├── server/                  # Bun backend
│   ├── src/
│   │   ├── index.ts         # Entry point — boots Fastify + WS server
│   │   ├── db.ts            # SQLite setup via bun:sqlite, schema, all query functions
│   │   ├── auth.ts          # JWT sign/verify helpers using jose
│   │   ├── routes/
│   │   │   └── auth.ts      # POST /auth/login  POST /auth/verify
│   │   └── ws/
│   │       └── handler.ts   # WebSocket connection lifecycle + broadcast
│   ├── admin.ts             # CLI script: add-user, remove-user, list-users
│   ├── data/                # SQLite database file lives here (gitignored)
│   │   └── chat.db
│   ├── package.json
│   └── .env                 # JWT_SECRET, PORT, DB_PATH (gitignored — Bun reads this automatically)
│
├── web/                     # Next.js frontend
│   ├── app/
│   │   ├── page.jsx         # Login page (redirects to /chat if JWT exists)
│   │   ├── chat/
│   │   │   └── page.jsx     # Chat room page (protected)
│   │   └── layout.jsx
│   ├── components/
│   │   ├── LoginForm.jsx
│   │   ├── ChatRoom.jsx     # Holds WS connection, renders messages + input
│   │   ├── MessageList.jsx
│   │   └── MessageInput.jsx
│   ├── lib/
│   │   └── ws.js            # WebSocket singleton + reconnect logic
│   ├── package.json
│   └── .env.local           # NEXT_PUBLIC_SERVER_URL, NEXT_PUBLIC_WS_URL
│
├── terminal/                # Bun TUI client
│   ├── src/
│   │   ├── index.ts         # Entry point — login prompt → chat screen
│   │   ├── ui.ts            # openTUI renderer, layout, components
│   │   └── ws.ts            # WebSocket connection + message handling
│   ├── package.json
│   └── .env                 # SERVER_URL, WS_URL (Bun reads automatically)
│
├── mobile/                  # React Native (Expo) client — Bun as package manager
│   ├── app/
│   │   ├── index.jsx        # Login screen
│   │   └── chat.jsx         # Chat room screen
│   ├── components/
│   │   ├── LoginForm.jsx
│   │   └── ChatRoom.jsx
│   ├── lib/
│   │   └── ws.js            # WebSocket connection manager
│   ├── app.json
│   ├── package.json
│   └── .env                 # EXPO_PUBLIC_SERVER_URL, EXPO_PUBLIC_WS_URL
│
└── nginx/
    └── chat.conf            # nginx reverse proxy config (reference)
```

---

## Tech Stack — Exact Packages and Versions

> **Universal runtime: Bun.** Every part of this project — server, web, terminal, mobile tooling — runs on or is managed by Bun. Install once: `curl -fsSL https://bun.sh/install | bash`. Use `bun` everywhere instead of `node`/`npm`/`npx`.

### Server


| Package               | Version  | Purpose                                    |
| --------------------- | -------- | ------------------------------------------ |
| `bun`                 | latest   | Runtime (replaces Node.js)                 |
| `fastify`             | ^4.x     | HTTP server                                |
| `@fastify/cors`       | ^8.x     | CORS for web client                        |
| `@fastify/rate-limit` | ^9.x     | Rate limit login endpoint                  |
| `ws`                  | ^8.x     | WebSocket server                           |
| `bun:sqlite`          | built-in | SQLite database (zero install, Bun native) |
| `jose`                | ^5.x     | JWT sign + verify                          |
| `bcryptjs`            | ^2.x     | Password hashing                           |


> **No `dotenv` needed.** Bun reads `.env` files automatically in all environments. Just use `process.env.VAR` directly.

### Web


| Package                  | Version           | Purpose                   |
| ------------------------ | ----------------- | ------------------------- |
| `next`                   | 14.x (App Router) | Framework                 |
| `react`                  | ^18.x             | UI                        |
| `reconnecting-websocket` | ^4.x              | Auto-reconnect WS wrapper |


> Run with `bun dev`, `bun run build`, `bun start`. Scaffold with `bunx create-next-app`.

### Terminal


| Package         | Version | Purpose                    |
| --------------- | ------- | -------------------------- |
| `@opentui/core` | latest  | TUI rendering (Bun-native) |
| `ws`            | ^8.x    | WebSocket client           |


> No `dotenv` needed — Bun reads `.env` automatically. No `node-fetch` needed — Bun has `fetch` built in.

### Mobile


| Package                    | Version         | Purpose                |
| -------------------------- | --------------- | ---------------------- |
| `expo`                     | ~51.x           | React Native framework |
| `react-native`             | managed by Expo |                        |
| `@react-navigation/native` | ^6.x            | Screen navigation      |
| `@react-navigation/stack`  | ^6.x            | Stack navigator        |
| `expo-secure-store`        | ~13.x           | Secure JWT storage     |


> Expo's Metro bundler and on-device Hermes runtime are unchanged — Bun replaces npm/npx only as the package manager and script runner. Scaffold with `bunx create-expo-app`.

---

## Database Schema

File: `server/src/db.ts`

> Use Bun's built-in `**bun:sqlite`** — zero install, no native compilation, same synchronous API as `better-sqlite3`.

```sql
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  password_hash TEXT  NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  username    TEXT    NOT NULL,  -- denormalized for fast reads
  content     TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
```

**Query functions to implement in `db.ts`:**

- `getUserByUsername(username)` → row or undefined
- `createUser(username, passwordHash)` → void
- `deleteUser(username)` → void
- `listUsers()` → array
- `insertMessage(userId, username, content)` → inserted row id
- `getRecentMessages(limit = 100)` → last N messages ordered by created_at ASC

---

## Environment Variables

### `server/.env`

```
PORT=3001
JWT_SECRET=replace_this_with_a_long_random_string_minimum_32_chars
DB_PATH=./data/chat.db
```

### `web/.env.local`

```
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

In production replace with `https://` and `wss://` URLs.

### `terminal/.env`

```
SERVER_URL=http://localhost:3001
WS_URL=ws://localhost:3001
```

### `mobile/.env`

```
EXPO_PUBLIC_SERVER_URL=http://localhost:3001
EXPO_PUBLIC_WS_URL=ws://localhost:3001
```

---

## Server Implementation

### `server/src/index.ts` — Entry Point

Boot sequence:

1. Initialize SQLite (run schema migrations) via `db.ts`
2. Create Fastify instance with logger enabled
3. Register `@fastify/cors` (allow all origins in dev; lock down in prod)
4. Register `@fastify/rate-limit` (max 10 requests per minute on login route)
5. Register auth routes from `routes/auth.ts`
6. Attach the `ws.Server` to Fastify's underlying `http.Server` with path `/ws`
7. Pass the `ws.Server` instance into the WebSocket handler (`ws/handler.ts`)
8. Listen on `PORT`

> **No `dotenv` import needed.** Bun loads `.env` automatically before your code runs.

**Critical:** Fastify and the `ws` WebSocket server share the same underlying `http.Server`. Do NOT create two separate servers. Use `fastify.server` as the `server` option when constructing `new WebSocketServer({ server: fastify.server, path: '/ws' })`.

```ts
// Skeleton — fill in the implementations
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { WebSocketServer } from 'ws';
import { initDb } from './db.ts';
import authRoutes from './routes/auth.ts';
import { handleConnection } from './ws/handler.ts';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });
await fastify.register(rateLimit, { max: 10, timeWindow: '1 minute' });
await fastify.register(authRoutes, { prefix: '/auth' });

initDb();

const wss = new WebSocketServer({ server: fastify.server, path: '/ws' });
wss.on('connection', (socket, req) => handleConnection(socket, req, wss));

await fastify.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' });
```

---

### `server/src/db.ts` — Database Layer

Use Bun's built-in `**bun:sqlite**` — synchronous API, zero native compilation, ships with Bun. Same interface as `better-sqlite3`.

```ts
import { Database } from 'bun:sqlite';

let db: Database;

export function initDb() {
  db = new Database(process.env.DB_PATH || './data/chat.db');
  db.run('PRAGMA journal_mode = WAL');  // important for concurrent reads
  db.run('PRAGMA foreign_keys = ON');
  db.run(`
    CREATE TABLE IF NOT EXISTS users ( ... );
    CREATE TABLE IF NOT EXISTS messages ( ... );
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);
}

export function getUserByUsername(username: string) {
  return db.query('SELECT * FROM users WHERE username = ?').get(username);
}

export function createUser(username: string, passwordHash: string) {
  db.query('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
}

export function deleteUser(username: string) {
  db.query('DELETE FROM users WHERE username = ?').run(username);
}

export function listUsers() {
  return db.query('SELECT id, username, created_at FROM users ORDER BY created_at').all();
}

export function insertMessage(userId: number, username: string, content: string) {
  const result = db.query(
    'INSERT INTO messages (user_id, username, content) VALUES (?, ?, ?)'
  ).run(userId, username, content);
  return result.lastInsertRowid;
}

export function getRecentMessages(limit = 100) {
  return db.query(
    'SELECT id, username, content, created_at FROM messages ORDER BY created_at DESC LIMIT ?'
  ).all(limit).reverse();
}
```

---

### `server/src/auth.js` — JWT Helpers

Use `jose` with HS256 algorithm. The secret must be at least 32 characters.

```js
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const ALG = 'HS256';
const EXPIRY = '7d';

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secret);
  return payload;  // contains { userId, username, iat, exp }
}
```

---

### `server/src/routes/auth.js` — HTTP Routes

`**POST /auth/login**`

- Body: `{ username: string, password: string }`
- Fetch user row by username
- If not found → 401
- `bcrypt.compare(password, user.password_hash)` → if false → 401
- Sign JWT with `{ userId: user.id, username: user.username }`
- Return `{ token: "..." }`

`**POST /auth/verify**` (optional, useful for clients to check token validity on startup)

- Body: `{ token: string }`
- Verify JWT → return `{ valid: true, username }` or 401

```js
import bcrypt from 'bcryptjs';
import { getUserByUsername } from '../db.js';
import { signToken } from '../auth.js';

export default async function authRoutes(fastify) {
  fastify.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const { username, password } = request.body;
    if (!username || !password) return reply.code(400).send({ error: 'Missing fields' });

    const user = getUserByUsername(username);
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });

    const token = await signToken({ userId: user.id, username: user.username });
    return { token };
  });
}
```

---

### `server/src/ws/handler.js` — WebSocket Core

This is the heart of the system. Handle the full lifecycle:

**State:** Maintain a `Map<WebSocket, { userId, username }>` called `clients` for all authenticated connections.

**On new connection (`handleConnection`):**

1. Set a 10-second timeout — if the client does not send a valid `auth` message within 10 seconds, terminate the connection.
2. Listen for `message` events on the socket.

**On receiving a message:**

- Parse JSON. If parsing fails, send `{ type: 'error', message: 'invalid json' }` and return.
- Dispatch on `data.type`:
  **`type: 'auth'`**
  - Verify the JWT from `data.token`
  - If invalid → send `{ type: 'error', message: 'unauthorized' }` and terminate
  - Clear the auth timeout
  - Add socket + user info to `clients` map
  - Fetch recent messages from DB and send `{ type: 'history', messages: [...] }`
  - Broadcast to all OTHER authenticated clients: `{ type: 'system', message: 'alice joined' }`
  `**type: 'message'`**
  - If socket is not in `clients` map (not authenticated) → ignore
  - Validate `data.content` is a non-empty string, max 2000 chars
  - Insert into DB via `insertMessage()`
  - Build message object: `{ type: 'message', id, from: username, content, ts: Date.now() }`
  - Broadcast to ALL authenticated clients including sender (so sender sees their own message confirmed)

**On `close` event:**

- Remove socket from `clients` map
- Broadcast `{ type: 'system', message: 'alice left' }` to remaining clients

**Broadcast helper:**

```js
function broadcast(wss, clients, data, excludeSocket = null) {
  const payload = JSON.stringify(data);
  for (const [socket, info] of clients) {
    if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}
```

**Full handler skeleton:**

```js
import { verifyToken } from '../auth.js';
import { getRecentMessages, insertMessage } from '../db.js';
import { WebSocket } from 'ws';

const clients = new Map();  // socket → { userId, username }

export function handleConnection(socket, req, wss) {
  // Auth timeout: close unauthenticated connections after 10s
  const authTimeout = setTimeout(() => {
    if (!clients.has(socket)) {
      socket.terminate();
    }
  }, 10000);

  socket.on('message', async (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    if (data.type === 'auth') {
      try {
        const payload = await verifyToken(data.token);
        clearTimeout(authTimeout);
        clients.set(socket, { userId: payload.userId, username: payload.username });

        // Send history
        const messages = getRecentMessages(100);
        socket.send(JSON.stringify({ type: 'history', messages }));

        // Announce join
        broadcast(wss, clients, {
          type: 'system',
          message: `${payload.username} joined`
        }, socket);

      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'unauthorized' }));
        socket.terminate();
      }
      return;
    }

    if (data.type === 'message') {
      const user = clients.get(socket);
      if (!user) return;

      const content = String(data.content || '').trim().slice(0, 2000);
      if (!content) return;

      insertMessage(user.userId, user.username, content);
      broadcast(wss, clients, {
        type: 'message',
        from: user.username,
        content,
        ts: Date.now()
      });
    }
  });

  socket.on('close', () => {
    const user = clients.get(socket);
    clients.delete(socket);
    if (user) {
      broadcast(wss, clients, { type: 'system', message: `${user.username} left` });
    }
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
}

function broadcast(wss, clients, data, excludeSocket = null) {
  const payload = JSON.stringify(data);
  for (const [socket] of clients) {
    if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}
```

---

### `server/admin.js` — User Management CLI

Run with Node.js directly. Usage:

```bash
node admin.js add-user <username> <password>
node admin.js remove-user <username>
node admin.js list-users
```

```js
import bcrypt from 'bcryptjs';
import { initDb, createUser, deleteUser, listUsers, getUserByUsername } from './src/db.js';
import 'dotenv/config';

const [,, command, ...args] = process.argv;
initDb();

if (command === 'add-user') {
  const [username, password] = args;
  if (!username || !password) {
    console.error('Usage: node admin.js add-user <username> <password>');
    process.exit(1);
  }
  if (getUserByUsername(username)) {
    console.error(`User "${username}" already exists.`);
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  createUser(username, hash);
  console.log(`✓ User "${username}" created.`);

} else if (command === 'remove-user') {
  const [username] = args;
  deleteUser(username);
  console.log(`✓ User "${username}" removed.`);

} else if (command === 'list-users') {
  const users = listUsers();
  if (users.length === 0) { console.log('No users.'); process.exit(0); }
  users.forEach(u => console.log(`  ${u.id}  ${u.username}  (created: ${new Date(u.created_at * 1000).toISOString()})`));

} else {
  console.log('Commands: add-user, remove-user, list-users');
}
```

---

## WebSocket Message Protocol (Canonical Reference)

Every message is a JSON object with a `type` field. This is the complete protocol both server and all clients must implement.

### Client → Server


| type      | payload               | when                           |
| --------- | --------------------- | ------------------------------ |
| `auth`    | `{ token: string }`   | First message after connecting |
| `message` | `{ content: string }` | Send a chat message            |


### Server → Client


| type      | payload                                         | when                            |
| --------- | ----------------------------------------------- | ------------------------------- |
| `history` | `{ messages: Message[] }`                       | Sent once after successful auth |
| `message` | `{ from: string, content: string, ts: number }` | New message from any user       |
| `system`  | `{ message: string }`                           | Join/leave notifications        |
| `error`   | `{ message: string }`                           | Auth failure or bad request     |


### Message object shape (in history array)

```json
{
  "id": 42,
  "username": "alice",
  "content": "hello world",
  "created_at": 1717000000
}
```

---

## Web Client — Next.js (App Router)

### Login flow

- `app/page.jsx` renders `<LoginForm />`
- On submit: `POST /auth/login` with `{ username, password }`
- On success: store token in `localStorage` as `chat_token`, store username as `chat_username`
- Redirect to `/chat`
- On `/chat` mount: if no token in localStorage, redirect back to `/`

### WebSocket management — `lib/ws.js`

Create a singleton WebSocket manager. Use `reconnecting-websocket` package.

```js
import ReconnectingWebSocket from 'reconnecting-websocket';

let rws = null;
const listeners = new Set();

export function connectWS(token, onMessage) {
  const url = process.env.NEXT_PUBLIC_WS_URL + '/ws';
  rws = new ReconnectingWebSocket(url);

  rws.addEventListener('open', () => {
    rws.send(JSON.stringify({ type: 'auth', token }));
  });

  rws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  });

  return rws;
}

export function sendMessage(content) {
  if (rws && rws.readyState === WebSocket.OPEN) {
    rws.send(JSON.stringify({ type: 'message', content }));
  }
}

export function disconnectWS() {
  if (rws) { rws.close(); rws = null; }
}
```

### `components/ChatRoom.jsx`

- On mount: read token from localStorage, call `connectWS(token, handleMessage)`
- On unmount: call `disconnectWS()`
- `handleMessage(data)`:
  - `type === 'history'` → set messages state to `data.messages` (map to display format)
  - `type === 'message'` → append to messages state
  - `type === 'system'` → append as system message (styled differently)
  - `type === 'error'` → if "unauthorized", clear localStorage and redirect to `/`
- Render: `<MessageList messages={messages} />` + `<MessageInput onSend={sendMessage} />`
- Auto-scroll `MessageList` to bottom on new messages (use `useEffect` + `scrollIntoView` on a bottom sentinel div)

### `components/MessageInput.jsx`

- Controlled textarea
- Send on Enter key (Shift+Enter for newline)
- Disable send button if content is empty or whitespace

---

## Terminal Client — openTUI

> **Runtime:** Bun. All files are `.ts`. Run with `bun src/index.ts`.
> **Package:** `@opentui/core` → [https://opentui.com](https://opentui.com) | [https://github.com/anomalyco/opentui](https://github.com/anomalyco/opentui)

### Layout (`src/ui.ts`)

openTUI uses a flexbox-based component tree. The renderer owns the root, and you build the UI by adding `Box`, `Text`, `ScrollBox`, and `Input` components as children.

Target layout — two panels stacked vertically:

```
┌─────────────────────────────────────────────┐
│  [12:01] alice: hey everyone                │
│  [12:02] bob: yo                            │
│  * charlie joined                           │
│                                             │  ← ScrollBox (fills available height)
│                                             │
├─────────────────────────────────────────────┤
│  Type a message and press Enter...          │  ← Input (fixed 3 rows)
└─────────────────────────────────────────────┘
```

```ts
import { createCliRenderer, Box, Text, ScrollBox, Input } from "@opentui/core";

export async function createUI() {
  const renderer = await createCliRenderer({ exitOnCtrlC: false });

  // Root layout: column, full terminal height
  const root = renderer.root;
  root.update({ flexDirection: "column", width: "100%", height: "100%" });

  // Messages area — scrollable, takes all remaining space
  const scrollBox = ScrollBox(
    { flexGrow: 1, width: "100%", flexDirection: "column", overflowY: "scroll" },
  );

  // Input area — fixed height at the bottom
  const inputBox = Box(
    { width: "100%", height: 3, borderStyle: "single", padding: 1 },
  );

  const inputField = Input({
    width: "100%",
    placeholder: "Type a message and press Enter...",
    fg: "#FFFFFF",
  });

  inputBox.add(inputField);
  root.add(scrollBox);
  root.add(inputBox);

  return { renderer, scrollBox, inputField };
}

// Append a chat message into the scroll area
export function appendMessage(
  scrollBox: ReturnType<typeof ScrollBox>,
  from: string,
  content: string,
  ts: number,
) {
  const time = new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  scrollBox.add(
    Text({ content: `[${time}] ${from}: ${content}`, fg: "#FFFFFF" }),
  );
  scrollBox.scrollToBottom?.();
}

// Append a system event (join/leave) in a muted colour
export function appendSystem(
  scrollBox: ReturnType<typeof ScrollBox>,
  message: string,
) {
  scrollBox.add(
    Text({ content: `  * ${message}`, fg: "#888888" }),
  );
  scrollBox.scrollToBottom?.();
}

// Prepend history messages — called once after auth
export function prependHistory(
  scrollBox: ReturnType<typeof ScrollBox>,
  messages: Array<{ username: string; content: string; created_at: number }>,
) {
  for (const msg of messages) {
    appendMessage(scrollBox, msg.username, msg.content, msg.created_at * 1000);
  }
}
```

### Login flow (`src/index.ts`)

openTUI does not have a built-in prompt widget, so use Node-compatible `readline` (Bun supports it) before initialising the renderer:

```ts
import readline from "readline";
import { createUI, appendMessage, appendSystem, prependHistory } from "./ui.ts";
import { connectWS, sendMessage, disconnectWS } from "./ws.ts";
import "dotenv/config";

async function prompt(question: string, muted = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (muted) {
    // Hide password input
    (rl as any).stdoutMuted = true;
    rl.on("line", () => {});
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (muted) process.stdout.write("\n");
      resolve(answer);
    });
    if (muted) {
      const orig = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: string, ...args: any[]) => {
        if (typeof chunk === "string" && chunk !== "\n") return true;
        return orig(chunk, ...args);
      };
    }
  });
}

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${process.env.SERVER_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const { token } = await res.json() as { token: string };
  return token;
}

async function main() {
  console.clear();
  console.log("=== Private Chat ===\n");

  let token = "";
  while (!token) {
    const username = await prompt("Username: ");
    const password = await prompt("Password: ", true);
    try {
      token = await login(username, password);
    } catch {
      console.log("Login failed. Try again.\n");
    }
  }

  // Login succeeded — boot the TUI
  const { renderer, scrollBox, inputField } = await createUI();

  // Connect WebSocket
  connectWS(token, (data) => {
    if (data.type === "history") {
      prependHistory(scrollBox, data.messages);
    } else if (data.type === "message") {
      appendMessage(scrollBox, data.from, data.content, data.ts);
    } else if (data.type === "system") {
      appendSystem(scrollBox, data.message);
    } else if (data.type === "error" && data.message === "unauthorized") {
      disconnectWS();
      renderer.destroy();
      console.error("Session expired. Please re-run and log in again.");
      process.exit(1);
    }
  });

  // Handle input submission on Enter
  inputField.on("submit", (value: string) => {
    const content = value.trim();
    if (content) {
      sendMessage(content);
      inputField.clear();
    }
  });

  // Ctrl+C to exit cleanly
  renderer.on("exit", () => {
    disconnectWS();
    process.exit(0);
  });
}

main();
```

### WebSocket (`src/ws.ts`)

Bun has `WebSocket` built in as a global — no `ws` package needed on the client side. Use it directly:

```ts
let ws: WebSocket | null = null;
let reconnectToken = "";
let reconnectHandler: ((data: any) => void) | null = null;

export function connectWS(token: string, onMessage: (data: any) => void) {
  reconnectToken = token;
  reconnectHandler = onMessage;

  ws = new WebSocket(`${process.env.WS_URL}/ws`);

  ws.onopen = () => {
    ws!.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      onMessage(data);
    } catch {}
  };

  ws.onclose = () => {
    // Reconnect after 2s
    setTimeout(() => connectWS(reconnectToken, reconnectHandler!), 2000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function sendMessage(content: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "message", content }));
  }
}

export function disconnectWS() {
  reconnectHandler = null; // prevent reconnect loop
  ws?.close();
  ws = null;
}
```

### Key bindings

- `Ctrl+C` → triggers `renderer.on("exit")` handler → disconnect WS and exit
- `Enter` on input field → triggers `inputField.on("submit")` → send message, clear field

### Running the terminal client

```bash
cd terminal
bun src/index.ts
```

> **Important:** Always test the TUI in a proper system terminal (iTerm2, Windows Terminal, GNOME Terminal, etc.). IDE embedded terminals often have limited ANSI support and will not render openTUI correctly.

---

## Mobile Client — React Native (Expo)

### Navigation setup (`app/index.jsx` and `app/chat.jsx`)

Use `@react-navigation/stack`. Two screens: `Login` and `Chat`.

### Token storage

Use `expo-secure-store` for all token storage. Do NOT use AsyncStorage for tokens — it is not encrypted.

```js
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('chat_token', token);
const token = await SecureStore.getItemAsync('chat_token');
await SecureStore.deleteItemAsync('chat_token');
```

### WebSocket management (`lib/ws.js`)

React Native has `WebSocket` as a global (no import needed). Same pattern as web client:

```js
let ws = null;

export function connectWS(token, onMessage) {
  ws = new WebSocket(process.env.EXPO_PUBLIC_WS_URL + '/ws');

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', token }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  ws.onclose = () => {
    // Reconnect after 2 seconds
    setTimeout(() => connectWS(token, onMessage), 2000);
  };
}

export function sendMessage(content) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'message', content }));
  }
}

export function disconnectWS() {
  if (ws) { ws.close(); ws = null; }
}
```

### Chat screen UI

Use React Native `FlatList` for messages (not ScrollView — FlatList is virtualized and handles large message lists).

- Set `inverted={false}` and scroll to bottom on new messages with `ref.current.scrollToEnd({ animated: true })`
- `KeyboardAvoidingView` wrapper so the input doesn't get covered by the keyboard
- `TextInput` at the bottom with a Send button
- Submit on Send button press (no Enter key behavior needed for mobile)

### Login screen

- Two `TextInput` components: username (autoCapitalize="none") and password (secureTextEntry={true})
- On submit: POST to login, store token with SecureStore, navigate to Chat screen
- On mount of Chat screen: read token from SecureStore, if null navigate back to Login

---

## Build Order (Phases)

### Phase 1 — Server (do this first, everything else depends on it)

1. `mkdir server && cd server && npm init -y`
2. Install all server packages
3. Create `data/` directory, add to `.gitignore`
4. Implement `db.js` → run it standalone and verify tables are created
5. Implement `auth.js` → write a quick test: `signToken({ userId: 1, username: 'test' })` then `verifyToken(result)` and log payload
6. Implement `routes/auth.js`
7. Implement `ws/handler.js`
8. Implement `index.js` and start the server
9. **Test with websocat:**
  ```bash
   # Install websocat: https://github.com/vi/websocat
   # Test login:
   curl -X POST http://localhost:3001/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"alice","password":"test123"}'
   # Copy the token, then test WebSocket:
   websocat ws://localhost:3001/ws
   # Paste: {"type":"auth","token":"<TOKEN_HERE>"}
   # Should receive history response
   # Paste: {"type":"message","content":"hello!"}
   # Should receive broadcast
  ```
10. Implement `admin.js` and create test users

### Phase 2 — Web Client

1. `npx create-next-app@latest web --app --no-typescript --tailwind --eslint`
2. Install `reconnecting-websocket`
3. Build login page + form
4. Build `lib/ws.js`
5. Build `ChatRoom`, `MessageList`, `MessageInput` components
6. Test end-to-end in browser

### Phase 3 — Terminal Client

1. Install Bun if not already: `curl -fsSL https://bun.sh/install | bash`
2. `mkdir terminal && cd terminal && bun init -y`
3. `bun add @opentui/core dotenv`
4. Build `src/ui.ts` (renderer + layout + component helpers)
5. Build `src/ws.ts` (WebSocket connection — use Bun's built-in WebSocket global)
6. Build `src/index.ts` (login flow via readline, then boot TUI)
7. Run with `bun src/index.ts`
8. **Always test in a proper system terminal** (iTerm2, Windows Terminal, GNOME Terminal) — IDE embedded terminals have limited ANSI support and openTUI will not render correctly inside them

### Phase 4 — Mobile Client

1. `npx create-expo-app mobile`
2. Install navigation and secure-store packages
3. Build Login screen
4. Build Chat screen with FlatList
5. Build `lib/ws.js`
6. Test with Expo Go app on phone (ensure phone and dev machine are on same network, or use a deployed server URL)

### Phase 5 — Production Deployment

1. Provision a VPS (Hetzner CX11 or DigitalOcean Droplet — Ubuntu 24.04 LTS)
2. Install Node.js 20 LTS, nginx, certbot
3. Clone repo onto server
4. `cd server && npm install && node admin.js add-user <you> <password>`
5. Configure PM2: `pm2 start src/index.js --name chat-server && pm2 save && pm2 startup`
6. Configure nginx (see section below)
7. Obtain TLS certificate with certbot
8. Update client `.env` files with production `https://` and `wss://` URLs
9. Deploy web client: `cd web && npm run build && npm start` (or deploy to Vercel)

---

## nginx Configuration

File: `nginx/chat.conf`

```nginx
server {
    listen 80;
    server_name yourchat.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourchat.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourchat.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourchat.yourdomain.com/privkey.pem;

    # HTTP API and WebSocket — same upstream
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        # Critical for WebSocket upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keep WebSocket connections alive
        proxy_read_timeout 86400;
    }
}
```

---

## Security Rules — Non-Negotiable

1. **Passwords:** Always hash with bcrypt, cost factor 12. Never store plain text. Never log passwords.
2. **JWT secret:** Minimum 32 random characters. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never commit to git.
3. **Token expiry:** 7 days. After expiry the client gets a 401 on the next WS auth attempt — show the login screen.
4. **CORS:** In production, restrict `@fastify/cors` to your actual web client origin. Do not use `origin: true` in production.
5. **Rate limiting:** The `/auth/login` route must be rate-limited (10 req/min per IP). This prevents brute-force attacks.
6. **Input validation:** Max message content length: 2000 chars. Trim whitespace. Reject empty messages. Sanitize before DB insert (better-sqlite3 uses prepared statements so SQL injection is not a risk, but still validate).
7. **WSS in production:** Only ever use `wss://` in production. Plain `ws://` sends data unencrypted.
8. **Admin script:** Only run on the server directly. Never expose user management via an HTTP API.
9. **DB file:** Keep `server/data/chat.db` outside the repo (add to `.gitignore`). Back it up regularly.

---

## Error Handling Patterns

### Server

- Wrap all async WebSocket handlers in try/catch. A thrown error in a `message` handler will crash the process if uncaught.
- On unhandled WS errors, log and remove the client from the `clients` map.
- Use Fastify's built-in error handling for HTTP routes.

### Clients (all three)

- On WS `error` event: log it, attempt reconnect after delay.
- On receiving `{ type: 'error', message: 'unauthorized' }` from server: clear stored token, redirect to login.
- On network failure (WS closed unexpectedly): show a "Reconnecting..." indicator to the user, attempt reconnect.
- On login HTTP errors: show the error message inline (do not alert()).

---

## Testing the Full Stack Locally

```bash
# Terminal 1 — start server
cd server && node src/index.js

# Terminal 2 — add test users
cd server
node admin.js add-user alice password123
node admin.js add-user bob password456

# Terminal 3 — open two websocat connections and chat between them
# (or open two browser tabs on the web client)

# Terminal 4 — start web client
cd web && npm run dev
```

Open two browser tabs at `http://localhost:3000`, log in as alice and bob, and verify messages appear in real time.

---

## Common Pitfalls to Avoid


| Pitfall                                                          | Solution                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| WebSocket server and Fastify on different ports                  | Share the same `http.Server` instance — use `fastify.server`                                                                      |
| openTUI not rendering in IDE terminal                            | Always run `bun src/index.ts` in a real system terminal (iTerm2, Windows Terminal, GNOME Terminal) — not an IDE embedded terminal |
| openTUI requires Bun — `node src/index.ts` will fail             | Install Bun: `curl -fsSL https://bun.sh/install | bash`, then use `bun` everywhere for the terminal client                        |
| React Native WebSocket not reconnecting on app background/resume | Add `AppState` listener to reconnect when app comes to foreground                                                                 |
| `better-sqlite3` not building on some platforms                  | Run `npm rebuild better-sqlite3` after Node version change                                                                        |
| CORS blocking WebSocket connection                               | WebSocket connections don't use CORS — only the HTTP login does                                                                   |
| Messages duplicated on history + live                            | History is sent once at auth time; live messages come after — no overlap                                                          |
| JWT stored in `localStorage` on mobile                           | Use `expo-secure-store` on mobile, `localStorage` is fine for web                                                                 |
| Nginx not proxying WebSocket                                     | Must include `Upgrade` and `Connection` headers and set `proxy_http_version 1.1`                                                  |
| `pm2 startup` command not run                                    | PM2 process won't survive server reboots — always run `pm2 startup` and `pm2 save`                                                |


---

## What Is NOT in Scope (Do Not Build)

- User self-registration (admin-only account creation)
- Multiple chat rooms
- Direct messages
- File/image uploads
- Message editing or deletion
- Read receipts or typing indicators
- Push notifications (mobile)
- End-to-end encryption (the server can see all messages — TLS encrypts in transit only)
- Admin web UI (the CLI script is sufficient)

These can all be added later as extensions. Build the clean core first.

---

## Quick Reference — All External Links


| Resource                   | URL                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Fastify docs               | [https://fastify.dev/docs/latest/](https://fastify.dev/docs/latest/)                                                                     |
| ws (WebSocket library)     | [https://github.com/websockets/ws](https://github.com/websockets/ws)                                                                     |
| better-sqlite3 docs        | [https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) |
| jose (JWT) docs            | [https://github.com/panva/jose](https://github.com/panva/jose)                                                                           |
| bcryptjs                   | [https://github.com/dcodeIO/bcrypt.js](https://github.com/dcodeIO/bcrypt.js)                                                             |
| Next.js App Router docs    | [https://nextjs.org/docs/app](https://nextjs.org/docs/app)                                                                               |
| reconnecting-websocket     | [https://github.com/pladaria/reconnecting-websocket](https://github.com/pladaria/reconnecting-websocket)                                 |
| openTUI docs               | [https://opentui.com/docs/getting-started](https://opentui.com/docs/getting-started)                                                     |
| openTUI GitHub             | [https://github.com/anomalyco/opentui](https://github.com/anomalyco/opentui)                                                             |
| Bun runtime                | [https://bun.sh](https://bun.sh)                                                                                                         |
| Expo docs                  | [https://docs.expo.dev](https://docs.expo.dev)                                                                                           |
| expo-secure-store          | [https://docs.expo.dev/versions/latest/sdk/securestore/](https://docs.expo.dev/versions/latest/sdk/securestore/)                         |
| React Navigation           | [https://reactnavigation.org/docs/getting-started](https://reactnavigation.org/docs/getting-started)                                     |
| PM2 docs                   | [https://pm2.keymetrics.io/docs/usage/quick-start/](https://pm2.keymetrics.io/docs/usage/quick-start/)                                   |
| Certbot (Let's Encrypt)    | [https://certbot.eff.org](https://certbot.eff.org)                                                                                       |
| websocat (WS testing tool) | [https://github.com/vi/websocat](https://github.com/vi/websocat)                                                                         |
| Hetzner (VPS hosting)      | [https://hetzner.com](https://hetzner.com)                                                                                               |
| DigitalOcean (VPS hosting) | [https://digitalocean.com](https://digitalocean.com)                                                                                     |


