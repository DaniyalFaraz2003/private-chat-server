import { useCallback, useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";

import { getServerUrl } from "@/lib/config";
import { theme } from "@/lib/theme";
import type { Session } from "@/lib/types";

type LoginScreenProps = {
  onLogin: (session: Session) => void;
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const { width } = useTerminalDimensions();
  const panelWidth = Math.min(52, Math.max(44, width - 4));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState<"username" | "password">("username");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocused((current) => (current === "username" ? "password" : "username"));
    }
  });

  const handleSubmit = useCallback(async () => {
    if (loading || !username.trim() || !password) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${getServerUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json()) as { token?: string; error?: string };

      if (!res.ok || !data.token) {
        setError(data.error ?? "AUTH_FAILED");
        return;
      }

      onLogin({ token: data.token, username });
    } catch {
      setError("UPLINK_UNREACHABLE");
    } finally {
      setLoading(false);
    }
  }, [loading, username, password, onLogin]);

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        backgroundColor: theme.background,
      }}
    >
      <box
        style={{
          width: panelWidth,
          flexDirection: "column",
          border: true,
          borderStyle: "single",
          borderColor: theme.outlineVariant,
          backgroundColor: theme.surfaceContainerLow,
        }}
      >
        <box style={{ width: "100%", flexDirection: "column", padding: 1, gap: 1 }}>
          <text style={{ fg: theme.onSurfaceVariant }}> USERNAME</text>
          <box
            style={{
              border: true,
              borderStyle: "single",
              borderColor: theme.outlineVariant,
              width: "100%",
              height: 3,
              paddingLeft: 1,
              paddingRight: 1,
              backgroundColor: theme.background,
            }}
          >
            <input
              placeholder="ROOT_ADMIN"
              focused={focused === "username"}
              onInput={setUsername}
              onSubmit={() => setFocused("password")}
            />
          </box>

          <text style={{ fg: theme.onSurfaceVariant }}> PASSWORD</text>
          <box
            style={{
              border: true,
              borderStyle: "single",
              borderColor: theme.outlineVariant,
              width: "100%",
              height: 3,
              paddingLeft: 1,
              paddingRight: 1,
              backgroundColor: theme.background,
            }}
          >
            <input
              placeholder="••••••••"
              focused={focused === "password"}
              onInput={setPassword}
              onSubmit={() => void handleSubmit()}
            />
          </box>

          {error ? <text style={{ fg: theme.error }}>{error.toUpperCase()}</text> : null}
          {loading ? <text style={{ fg: theme.onSurfaceVariant }}>AUTHENTICATING...</text> : null}

          <box
            style={{
              border: true,
              borderStyle: "single",
              borderColor: theme.primaryContainer,
              backgroundColor: theme.primaryContainer,
              width: "100%",
              height: 3,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <text style={{ fg: "#ffffff" }}>CONNECT</text>
          </box>
        </box>
      </box>

      <text style={{ fg: theme.outline, marginTop: 1 }}>
        Tab: switch field · Enter: submit
      </text>
    </box>
  );
}
