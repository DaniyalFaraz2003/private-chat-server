"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import { connectWS, disconnectWS, sendMessage } from "@/lib/ws";
import type { ChatMessage } from "@/lib/types";
import { historyToChatMessages } from "@/lib/types";

export default function ChatRoom() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username] = useState(
    () => localStorage.getItem("chat_username") ?? "",
  );

  useEffect(() => {
    const token = localStorage.getItem("chat_token");

    if (!token) {
      router.replace("/");
      return;
    }

    connectWS(token, (data) => {
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
    });

    return () => {
      disconnectWS();
    };
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_username");
    disconnectWS();
    router.replace("/");
  }

  return (
    <div className="flex h-full min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Private Chat</h1>
          {username ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Signed in as {username}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Log out
        </button>
      </header>

      <main className="mx-auto flex h-[calc(100vh-65px)] w-full max-w-3xl flex-1 flex-col border-x border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <MessageList messages={messages} />
        <MessageInput onSend={sendMessage} />
      </main>
    </div>
  );
}
