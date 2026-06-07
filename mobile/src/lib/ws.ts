import { getWsUrl } from "./config";
import type { ServerMessage } from "./types";

let ws: WebSocket | null = null;
let reconnectToken = "";
let reconnectHandler: ((data: ServerMessage) => void) | null = null;
let statusHandler: ((status: ConnectionStatus) => void) | null = null;
let shouldReconnect = true;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function connectWS(
  token: string,
  onMessage: (data: ServerMessage) => void,
  onStatusChange?: (status: ConnectionStatus) => void,
) {
  shouldReconnect = true;
  reconnectToken = token;
  reconnectHandler = onMessage;
  statusHandler = onStatusChange ?? null;

  statusHandler?.("connecting");

  ws = new WebSocket(`${getWsUrl()}/ws`);

  ws.onopen = () => {
    statusHandler?.("connected");
    ws?.send(JSON.stringify({ type: "auth", token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as ServerMessage;
      onMessage(data);
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    ws = null;
    if (shouldReconnect && reconnectHandler) {
      statusHandler?.("connecting");
      setTimeout(() => connectWS(reconnectToken, reconnectHandler!, statusHandler ?? undefined), 2000);
    } else {
      statusHandler?.("disconnected");
    }
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
  shouldReconnect = false;
  reconnectHandler = null;
  statusHandler = null;
  ws?.close();
  ws = null;
}
