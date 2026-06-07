import ReconnectingWebSocket from "reconnecting-websocket";
import type { ServerMessage } from "./types";

let rws: ReconnectingWebSocket | null = null;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function connectWS(
  token: string,
  onMessage: (data: ServerMessage) => void,
  onStatusChange?: (status: ConnectionStatus) => void,
) {
  const url = `${process.env.NEXT_PUBLIC_WS_URL}/ws`;
  rws = new ReconnectingWebSocket(url);

  onStatusChange?.("connecting");

  rws.addEventListener("open", () => {
    onStatusChange?.("connected");
    rws?.send(JSON.stringify({ type: "auth", token }));
  });

  rws.addEventListener("close", () => {
    if (rws) {
      onStatusChange?.("connecting");
    } else {
      onStatusChange?.("disconnected");
    }
  });

  rws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data as string) as ServerMessage;
    onMessage(data);
  });

  return rws;
}

export function sendMessage(content: string) {
  if (rws && rws.readyState === WebSocket.OPEN) {
    rws.send(JSON.stringify({ type: "message", content }));
  }
}

export function disconnectWS() {
  if (rws) {
    rws.close();
    rws = null;
  }
}
