import type { IncomingMessage } from "node:http";
import { verifyToken } from "../middleware/auth";
import { getRecentMessages, insertMessage } from "../db";
import { WebSocket, type RawData, type WebSocketServer } from "ws";

const clients = new Map<WebSocket, { userId: number, username: string }>();

function rawDataToString(raw: RawData): string {
    if (typeof raw === "string") return raw;
    if (Buffer.isBuffer(raw)) return raw.toString("utf8");
    if (Array.isArray(raw)) return Buffer.concat(raw).toString("utf8");
    return Buffer.from(raw).toString("utf8");
}

function broadcast(wss: WebSocketServer, clients: Map<WebSocket, { userId: number, username: string }>, data: any, excludeSocket: WebSocket | null) {
    const payload = JSON.stringify(data);
    for (const [socket] of clients) {
        if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
            socket.send(payload);
        }
    }
}

export function handleConnection(socket: WebSocket, _req: IncomingMessage, wss: WebSocketServer) {
    const authTimeout = setTimeout(() => {
        if (!clients.has(socket)) {
            socket.terminate();
        }
    }, 10000);

    socket.on("message", async (raw) => {
        let data;
        try { data = JSON.parse(rawDataToString(raw)); } catch { return; }

        if (data.type === "auth") {
            try {
                const payload = await verifyToken(data.token);
                clearTimeout(authTimeout);
                clients.set(socket, { userId: payload.userId, username: payload.username });

                const messages = getRecentMessages(100);
                socket.send(JSON.stringify({ type: "history", messages }));

                broadcast(wss, clients, { type: "system", message: `${payload.username} joined` }, socket);
            } catch {
                socket.send(JSON.stringify({ type: "error", message: "unauthorized" }));
                socket.terminate();
            }
            return;
        }

        if (data.type === "message") {
            const user = clients.get(socket);
            if (!user) return;

            const content = String(data.content || "").trim().slice(0, 2000);
            if (!content) return;

            insertMessage(user.userId, user.username, content);
            broadcast(wss, clients, { type: "message", from: user.username, content, ts: Date.now() }, null);
            return;
        }
    });

    socket.on("close", () => {
        const user = clients.get(socket);
        clients.delete(socket);
        if (user) {
            broadcast(wss, clients, { type: "system", message: `${user.username} left` }, null);
        }
    });

    socket.on("error", () => {
        clients.delete(socket);
    })
}