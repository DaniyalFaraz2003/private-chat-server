import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { TextareaRenderable } from "@opentui/core";

import { theme } from "@/lib/theme";
import type { ChatMessage, Session } from "@/lib/types";
import { historyToChatMessages } from "@/lib/types";
import { formatSystemMessage, getAuthorColor } from "@/lib/username-color";
import { connectWS, disconnectWS, sendMessage, type ConnectionStatus } from "@/lib/ws";

type ChatScreenProps = {
  session: Session;
  onLogout: () => void;
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

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

function statusColor(status: ConnectionStatus) {
  if (status === "connected") return theme.primary;
  if (status === "connecting") return theme.tertiary;
  return theme.error;
}

function systemBannerText(status: ConnectionStatus) {
  if (status === "connected") return "INITIALIZING BUFFER CONNECTION... OK";
  if (status === "connecting") return "INITIALIZING BUFFER CONNECTION...";
  return "BUFFER CONNECTION LOST";
}

function chatHistoryTitle(width: number) {
  const label = " CHAT_HISTORY ";
  const dashes = Math.max(4, width - label.length - 2);
  return `┌─${label}${"─".repeat(dashes)}┐`;
}

const MIN_INPUT_ROWS = 1;
const MAX_INPUT_ROWS = 6;

function measureInputRows(textarea: TextareaRenderable | null) {
  if (!textarea) return MIN_INPUT_ROWS;
  const lines = Math.max(MIN_INPUT_ROWS, textarea.lineCount, textarea.virtualLineCount);
  return Math.min(lines, MAX_INPUT_ROWS);
}

export default function ChatScreen({ session, onLogout }: ChatScreenProps) {
  const { width: terminalWidth } = useTerminalDimensions();
  const inputRef = useRef<TextareaRenderable | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [uptime, setUptime] = useState("0m");
  const [inputRows, setInputRows] = useState(MIN_INPUT_ROWS);

  const inputBarHeight = inputRows;
  const inputShellHeight = inputBarHeight + 2;
  const ruleLine = "─".repeat(Math.max(terminalWidth - 2, 0));

  useEffect(() => {
    connectWS(
      session.token,
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
          disconnectWS();
          onLogout();
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
  }, [session.token, onLogout]);

  useEffect(() => {
    if (!connectedAt) return;

    const tick = () => setUptime(formatUptime(Date.now() - connectedAt));
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [connectedAt]);

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
    setInputRows(MIN_INPUT_ROWS);
  }, []);

  const syncInputHeight = useCallback(() => {
    setInputRows(measureInputRows(inputRef.current));
  }, []);

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        backgroundColor: theme.surfaceContainerLowest,
        padding: 1,
        gap: 0,
      }}
    >
      <box
        style={{
          width: "100%",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          border: true,
          borderStyle: "single",
          borderColor: theme.outlineVariant,
          backgroundColor: theme.surfaceContainerLow,
          paddingLeft: 1,
          paddingRight: 1,
          height: 3,
        }}
      >
        <box style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
          <text style={{ fg: theme.onSurfaceVariant }}>Status:</text>
          <text style={{ fg: statusColor(connectionStatus), attributes: 1 }}>
            {statusLabel(connectionStatus)}
          </text>
          <text style={{ fg: theme.outlineVariant }}>|</text>
          <text style={{ fg: theme.onSurfaceVariant }}>Uptime:</text>
          <text style={{ fg: theme.onSurfaceVariant }}>{uptime}</text>
        </box>

        <box style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
          <text style={{ fg: theme.onSurfaceVariant }}>User:</text>
          <text style={{ fg: theme.primary, attributes: 1 }}>{session.username}</text>
          <text style={{ fg: theme.outlineVariant }}>|</text>
          <text style={{ fg: theme.onSurfaceVariant }}>^L Logout</text>
        </box>
      </box>

      <text style={{ fg: theme.outlineVariant }}>{ruleLine}</text>

      <box
        style={{
          flexGrow: 1,
          width: "100%",
          flexDirection: "column",
          border: true,
          borderStyle: "single",
          borderColor: theme.outlineVariant,
          backgroundColor: theme.surfaceContainerLowest,
          overflow: "hidden",
        }}
      >
        <box
          style={{
            width: "100%",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            border: true,
            borderStyle: "single",
            borderColor: theme.outlineVariant,
            backgroundColor: theme.surfaceContainerLow,
            paddingLeft: 1,
            paddingRight: 1,
            height: 1,
          }}
        >
          <text style={{ fg: theme.outline }}>{chatHistoryTitle(terminalWidth - 4)}</text>
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
            backgroundColor: theme.surfaceContainerLowest,
          }}
        >
          <box style={{ flexDirection: "row", gap: 1, marginBottom: 1 }}>
            <text style={{ fg: theme.primary }}>[SYSTEM]</text>
            <text style={{ fg: theme.onSurfaceVariant }}>
              {systemBannerText(connectionStatus)}
            </text>
          </box>

          {messages.length === 0 ? (
            <text style={{ fg: theme.onSurfaceVariant }}>No messages in buffer.</text>
          ) : (
            messages.map((message) =>
              message.kind === "system" ? (
                <box
                  key={message.id}
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    flexWrap: "no-wrap",
                    alignItems: "flex-start",
                  }}
                >
                  <text style={{ fg: theme.outlineVariant, flexShrink: 0 }}>
                    [{formatTime(message.ts)}]{" "}
                  </text>
                  <text style={{ fg: theme.stable, attributes: 1, flexShrink: 0 }}>
                    &lt;system&gt;
                  </text>
                  <text
                    wrapMode="word"
                    style={{
                      fg: theme.onSurfaceVariant,
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: 0,
                    }}
                  >
                    {" "}
                    {formatSystemMessage(message.content)}
                  </text>
                </box>
              ) : (
                <box
                  key={message.id}
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    flexWrap: "no-wrap",
                    alignItems: "flex-start",
                  }}
                >
                  <text style={{ fg: theme.outlineVariant, flexShrink: 0 }}>
                    [{formatTime(message.ts)}]{" "}
                  </text>
                  <text
                    style={{
                      fg: getAuthorColor(message.from ?? "", session.username),
                      attributes: 1,
                      flexShrink: 0,
                    }}
                  >
                    &lt;{message.from}&gt;
                  </text>
                  <text
                    wrapMode="word"
                    style={{
                      fg: theme.onSurface,
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: 0,
                    }}
                  >
                    {" "}
                    {message.content}
                  </text>
                </box>
              ),
            )
          )}
        </scrollbox>
      </box>

      <box
        style={{
          width: "100%",
          height: inputShellHeight,
          minHeight: inputShellHeight,
          flexDirection: "row",
          flexWrap: "no-wrap",
          alignItems: "flex-start",
          border: true,
          borderStyle: "single",
          borderColor: theme.outlineVariant,
          backgroundColor: theme.surfaceContainerLow,
          paddingLeft: 1,
          paddingRight: 1,
          gap: 1,
        }}
      >
        <box
          style={{
            height: 1,
            width: 1,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            alignSelf: inputRows === 1 ? "center" : "flex-start",
          }}
        >
          <text style={{ fg: theme.primary, attributes: 1 }}>λ</text>
        </box>
        <textarea
          ref={inputRef}
          wrapMode="word"
          placeholder="INPUT_COMMAND_OR_MESSAGE..."
          focused={true}
          scrollMargin={0}
          textColor={theme.onSurface}
          backgroundColor={theme.surfaceContainerLow}
          focusedBackgroundColor={theme.surfaceContainerLow}
          focusedTextColor={theme.onSurface}
          placeholderColor={theme.outline}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            height: inputBarHeight,
            minHeight: inputBarHeight,
            maxHeight: inputBarHeight,
            alignSelf: "flex-start",
          }}
          onContentChange={syncInputHeight}
          onKeyDown={(key) => {
            if ((key.name === "return" || key.name === "enter") && !key.shift) {
              key.preventDefault();
              handleSend();
              return;
            }

            queueMicrotask(syncInputHeight);
          }}
        />
      </box>

      <box
        style={{
          width: "100%",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingLeft: 1,
          paddingRight: 1,
          height: 1,
          marginTop: 0,
        }}
      >
        <text style={{ fg: theme.outlineVariant }}>
          <span style={{ fg: theme.primary, attributes: 1 }}>^C</span> QUIT ·{" "}
          <span style={{ fg: theme.primary, attributes: 1 }}>^L</span> LOGOUT
        </text>
        <text style={{ fg: theme.outlineVariant }}>SYSTEM_STABLE</text>
      </box>
    </box>
  );
}
