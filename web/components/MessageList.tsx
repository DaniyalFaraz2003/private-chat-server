"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import type { ConnectionStatus } from "@/lib/ws";
import { formatSystemMessage, getAuthorColorClass } from "@/lib/username-color";

type MessageListProps = {
  messages: ChatMessage[];
  username: string;
  connectionStatus: ConnectionStatus;
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isNearBottom(container: HTMLElement, threshold = 80) {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  );
}

export default function MessageList({
  messages,
  username,
  connectionStatus,
}: MessageListProps) {
  const containerRef = useRef<HTMLElement>(null);
  const stickToBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      stickToBottomRef.current = isNearBottom(container);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isInitialLoad =
      prevMessageCountRef.current === 0 && messages.length > 0;
    prevMessageCountRef.current = messages.length;

    if (isInitialLoad || stickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || connectionStatus !== "connected") return;
    if (!stickToBottomRef.current) return;

    container.scrollTop = container.scrollHeight;
  }, [connectionStatus]);

  return (
    <section
      ref={containerRef}
      id="terminal-feed"
      className="chat-feed h-0 min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-md font-code-md text-code-md"
    >
      <div className="space-y-1">
        <div className="mb-md flex gap-md border-b border-outline-variant/30 pb-sm opacity-50">
          <span className="text-primary">[SYSTEM]</span>
          <span>
            {connectionStatus === "connected"
              ? "INITIALIZING BUFFER CONNECTION... OK"
              : connectionStatus === "connecting"
                ? "INITIALIZING BUFFER CONNECTION..."
                : "BUFFER CONNECTION LOST"}
          </span>
        </div>

        {messages.length === 0 ? (
          <p className="text-on-surface-variant opacity-60">No messages in buffer.</p>
        ) : (
          messages.map((message) =>
            message.kind === "system" ? (
              <div
                key={message.id}
                className="my-xs py-sm text-primary/60 italic"
              >
                {formatSystemMessage(message.content)}
              </div>
            ) : (
              <div
                key={message.id}
                className="group flex gap-2 hover:bg-surface-variant/20"
              >
                <span className="shrink-0 text-outline">[{formatTime(message.ts)}]</span>
                <span
                  className={`shrink-0 font-bold ${getAuthorColorClass(message.from ?? "", username)}`}
                >
                  {message.from}:
                </span>
                <span className="text-on-surface">{message.content}</span>
              </div>
            ),
          )
        )}
      </div>
    </section>
  );
}
