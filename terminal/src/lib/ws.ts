import { getWsUrl } from "./config";
import type { ServerMessage } from "./types";

let ws: WebSocket | null = null;
let reconnectToken = "";
let reconnectHandler: ((data: ServerMessage) => void) | null = null;
let shouldReconnect = true;

export function connectWS(token: string, onMessage: (data: ServerMessage) => void) {
  shouldReconnect = true;
  reconnectToken = token;
  reconnectHandler = onMessage;

  ws = new WebSocket(`${getWsUrl()}/ws`);

  ws.onopen = () => {
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
      setTimeout(() => connectWS(reconnectToken, reconnectHandler!), 2000);
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
  ws?.close();
  ws = null;
}
