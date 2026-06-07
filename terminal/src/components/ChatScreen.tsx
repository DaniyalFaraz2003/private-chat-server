import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { TextareaRenderable } from "@opentui/core";

import type { ChatMessage, Session } from "@/lib/types";
import { historyToChatMessages } from "@/lib/types";
import { connectWS, disconnectWS, sendMessage } from "@/lib/ws";

type ChatScreenProps = {
  session: Session;
  onLogout: () => void;
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatScreen({ session, onLogout }: ChatScreenProps) {
  const { width: terminalWidth } = useTerminalDimensions();
  const inputRef = useRef<TextareaRenderable | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputWidth = Math.max(20, terminalWidth - 4);

  useEffect(() => {
    connectWS(session.token, (data) => {
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
        disconnectWS();
        onLogout();
      }
    });

    return () => {
      disconnectWS();
    };
  }, [session.token, onLogout]);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "l") {
      disconnectWS();
      onLogout();
    }
  });

  const handleSend = useCallback(() => {
    const content = (inputRef.current?.plainText ?? "").trim();
    if (!content) return;
    sendMessage(content);
    inputRef.current?.setText("");
  }, []);

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        backgroundColor: "#09090b",
      }}
    >
      <box
        style={{
          border: true,
          borderStyle: "single",
          borderColor: "#3f3f46",
          paddingLeft: 1,
          paddingRight: 1,
          height: 3,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#18181b",
        }}
      >
        <box style={{ flexDirection: "column" }}>
          <text style={{ fg: "#fafafa" }}>Private Chat</text>
          <text style={{ fg: "#71717a" }}>Signed in as {session.username}</text>
        </box>
        <text style={{ fg: "#52525b" }}>Ctrl+L log out · Ctrl+C exit</text>
      </box>

      <scrollbox
        scrollY={true}
        stickyScroll={true}
        stickyStart="bottom"
        padding={1}
        contentOptions={{ flexDirection: "column", gap: 0 }}
        style={{
          flexGrow: 1,
          width: "100%",
          backgroundColor: "#09090b",
        }}
        rootOptions={{
          border: true,
          borderStyle: "single",
          borderColor: "#27272a",
        }}
      >
        {messages.length === 0 ? (
          <text style={{ fg: "#71717a" }}>No messages yet.</text>
        ) : (
          messages.map((message) =>
            message.kind === "system" ? (
              <text key={message.id} style={{ fg: "#71717a" }}>
                {"  * "}
                {message.content}
              </text>
            ) : (
              <text key={message.id}>
                <span style={{ fg: "#71717a" }}>[{formatTime(message.ts)}] </span>
                <span style={{ fg: "#fafafa" }}>{message.from}: </span>
                <span style={{ fg: "#e4e4e7" }}>{message.content}</span>
              </text>
            ),
          )
        )}
      </scrollbox>

      <box
        style={{
          border: true,
          borderStyle: "single",
          borderColor: "#3f3f46",
          height: 5,
          width: "100%",
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 1,
          paddingBottom: 1,
          backgroundColor: "#18181b",
        }}
      >
        <textarea
          ref={inputRef}
          wrapMode="word"
          placeholder="Type a message (Enter to send, Shift+Enter for newline)..."
          focused={true}
          style={{
            width: inputWidth,
            height: 3,
            flexGrow: 1,
          }}
          onKeyDown={(key) => {
            if ((key.name === "return" || key.name === "enter") && !key.shift) {
              key.preventDefault();
              handleSend();
            }
          }}
        />
      </box>
    </box>
  );
}
