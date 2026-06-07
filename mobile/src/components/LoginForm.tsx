import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { saveSession } from "@/lib/auth-storage";
import { getServerUrl } from "@/lib/config";
import { theme } from "@/lib/theme";

type LoginFormProps = {
  onSuccess: () => void;
};

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
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

      await saveSession(data.token, username);
      onSuccess();
    } catch {
      setError("UPLINK_UNREACHABLE");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;

  return (
    <View style={styles.panel}>
      <View style={styles.panelBody}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            placeholder="ROOT_ADMIN"
            placeholderTextColor={theme.outline}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor={theme.outline}
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>CONNECT</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.accentBar}>
        <View style={styles.accentFill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceContainerLow,
  },
  panelBody: {
    padding: 24,
    gap: 16,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    color: theme.onSurfaceVariant,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    fontFamily: "monospace",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.background,
    color: theme.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    fontSize: 13,
    fontFamily: "monospace",
  },
  error: {
    color: theme.error,
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: "monospace",
    textTransform: "uppercase",
  },
  button: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.primaryContainer,
    backgroundColor: theme.primaryContainer,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 3,
  },
  accentBar: {
    height: 2,
    width: "100%",
    backgroundColor: theme.outlineVariant,
  },
  accentFill: {
    height: "100%",
    width: "33%",
    backgroundColor: theme.primaryContainer,
  },
});
