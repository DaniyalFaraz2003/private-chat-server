"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

type MessageListProps = {
  messages: ChatMessage[];
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageList({ messages }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 80;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No messages yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.id}>
              {message.kind === "system" ? (
                <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
                  * {message.content}
                </p>
              ) : (
                <div className="text-sm">
                  <span className="mr-2 text-zinc-500 dark:text-zinc-400">
                    [{formatTime(message.ts)}]
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {message.from}:
                  </span>{" "}
                  <span className="text-zinc-800 dark:text-zinc-200">{message.content}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
