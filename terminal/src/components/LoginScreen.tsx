import { useCallback, useState } from "react";
import { useKeyboard } from "@opentui/react";

import { getServerUrl } from "@/lib/config";
import type { Session } from "@/lib/types";

type LoginScreenProps = {
  onLogin: (session: Session) => void;
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
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
        setError(data.error ?? "Login failed");
        return;
      }

      onLogin({ token: data.token, username });
    } catch {
      setError("Could not reach the server");
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
        backgroundColor: "#09090b",
      }}
    >
      <box
        style={{
          border: true,
          borderStyle: "single",
          borderColor: "#3f3f46",
          padding: 2,
          flexDirection: "column",
          gap: 1,
          width: 52,
          backgroundColor: "#18181b",
        }}
      >
        <text style={{ fg: "#fafafa" }}>Private Chat</text>
        <text style={{ fg: "#71717a" }}>Sign in with your account</text>

        <text style={{ fg: "#a1a1aa", marginTop: 1 }}>Username</text>
        <box
          style={{
            border: true,
            borderStyle: "single",
            borderColor: "#52525b",
            width: "100%",
            height: 3,
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <input
            placeholder="Username"
            focused={focused === "username"}
            onInput={setUsername}
            onSubmit={() => setFocused("password")}
          />
        </box>

        <text style={{ fg: "#a1a1aa" }}>Password</text>
        <box
          style={{
            border: true,
            borderStyle: "single",
            borderColor: "#52525b",
            width: "100%",
            height: 3,
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <input
            placeholder="Password"
            focused={focused === "password"}
            onInput={setPassword}
            onSubmit={() => void handleSubmit()}
          />
        </box>

        {error ? <text style={{ fg: "#f87171" }}>{error}</text> : null}
        {loading ? <text style={{ fg: "#71717a" }}>Signing in...</text> : null}
      </box>

      <text style={{ fg: "#52525b", marginTop: 1 }}>
        Tab: switch field · Enter: submit
      </text>
    </box>
  );
}
