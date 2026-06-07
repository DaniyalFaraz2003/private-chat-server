"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import { connectWS, disconnectWS, sendMessage, type ConnectionStatus } from "@/lib/ws";
import type { ChatMessage } from "@/lib/types";
import { historyToChatMessages } from "@/lib/types";

function formatUptime(ms: number) {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function statusLabel(status: ConnectionStatus) {
  if (status === "connected") return "CONNECTED";
  if (status === "connecting") return "CONNECTING";
  return "DISCONNECTED";
}

function LogoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  );
}

export default function ChatRoom() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username] = useState(
    () => localStorage.getItem("chat_username") ?? "",
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [uptime, setUptime] = useState("0m");

  useEffect(() => {
    const token = localStorage.getItem("chat_token");

    if (!token) {
      router.replace("/");
      return;
    }

    connectWS(
      token,
      (data) => {
        if (data.type === "history") {
          setMessages(historyToChatMessages(data.messages));
          return;
        }

        if (data.type === "message") {
          setMessages((current) => [
            ...current,
            {
              id: `live-${data.ts}-${data.from}-${current.length}`,
              kind: "message",
              from: data.from,
              content: data.content,
              ts: data.ts,
            },
          ]);
          return;
        }

        if (data.type === "system") {
          setMessages((current) => [
            ...current,
            {
              id: `system-${Date.now()}-${current.length}`,
              kind: "system",
              content: data.message,
              ts: Date.now(),
            },
          ]);
          return;
        }

        if (data.type === "error" && data.message === "unauthorized") {
          localStorage.removeItem("chat_token");
          localStorage.removeItem("chat_username");
          router.replace("/");
        }
      },
      (status) => {
        setConnectionStatus(status);
        if (status === "connected") {
          setConnectedAt((current) => current ?? Date.now());
        }
      },
    );

    return () => {
      disconnectWS();
    };
  }, [router]);

  useEffect(() => {
    if (!connectedAt) return;

    const tick = () => setUptime(formatUptime(Date.now() - connectedAt));
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  function handleLogout() {
    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_username");
    disconnectWS();
    router.replace("/");
  }

  return (
    <main className="relative flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-background">
      <header className="fixed inset-x-0 top-0 z-20 flex h-12 shrink-0 items-center justify-between border-b border-outline-variant bg-background px-md">
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-xs">
            <span className="font-code-md text-code-md text-on-surface-variant">Status:</span>
            <span
              className={`font-code-md text-code-md ${
                connectionStatus === "connected"
                  ? "text-primary"
                  : connectionStatus === "connecting"
                    ? "text-tertiary"
                    : "text-error"
              }`}
            >
              {statusLabel(connectionStatus)}
            </span>
          </div>
          <div className="flex items-center gap-xs">
            <span className="font-code-md text-code-md text-on-surface-variant">Uptime:</span>
            <span className="font-code-md text-code-md text-on-surface-variant">{uptime}</span>
          </div>
        </div>

        <div className="flex items-center gap-md">
          {username ? (
            <div className="flex items-center gap-xs">
              <span className="font-code-md text-code-md text-on-surface-variant">User:</span>
              <span className="font-code-md text-code-md font-bold text-primary">{username}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="flex cursor-pointer items-center gap-sm px-sm py-xs text-on-surface-variant transition-all duration-75 hover:text-error"
          >
            <LogoutIcon />
            <span className="font-label-sm text-label-sm">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden pt-12">
        <MessageList
          messages={messages}
          username={username}
          connectionStatus={connectionStatus}
        />
        <MessageInput onSend={sendMessage} />
      </div>
    </main>
  );
}
