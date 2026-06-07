import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { clearSession, getToken, getUsername } from "@/lib/auth-storage";
import { theme, type as typography, fonts } from "@/lib/theme";
import type { ChatMessage } from "@/lib/types";
import { historyToChatMessages } from "@/lib/types";
import { formatSystemMessage, getAuthorColor } from "@/lib/username-color";
import { connectWS, disconnectWS, sendMessage, type ConnectionStatus } from "@/lib/ws";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
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

export default function ChatRoom() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const stickToBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState("");
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [uptime, setUptime] = useState("0m");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const token = await getToken();
      const storedUsername = (await getUsername()) ?? "";

      if (!token) {
        router.replace("/");
        return;
      }

      if (!active) return;

      setUsername(storedUsername);
      setReady(true);

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
            clearSession().then(() => router.replace("/"));
          }
        },
        (status) => {
          setConnectionStatus(status);
          if (status === "connected") {
            setConnectedAt((current) => current ?? Date.now());
          }
        },
      );
    }

    bootstrap();

    return () => {
      active = false;
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

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      if (stickToBottomRef.current) {
        scrollToBottom(true);
        // Second pass after keyboard animation finishes
        setTimeout(() => scrollToBottom(true), Platform.OS === "ios" ? 250 : 100);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  useEffect(() => {
    const isInitialLoad =
      prevMessageCountRef.current === 0 && messages.length > 0;
    prevMessageCountRef.current = messages.length;

    if (isInitialLoad || stickToBottomRef.current) {
      scrollToBottom(!isInitialLoad);
    }
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - contentOffset.y - layoutMeasurement.height;
      stickToBottomRef.current = distanceFromBottom < 80;
    },
    [],
  );

  const handleLogout = useCallback(async () => {
    disconnectWS();
    await clearSession();
    router.replace("/");
  }, [router]);

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!content) return;
    sendMessage(content);
    setDraft("");
    stickToBottomRef.current = true;
  }, [draft]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.kind === "system") {
        return (
          <View style={styles.messageRow}>
            <Text style={styles.timestamp}>[{formatTime(item.ts)}]</Text>
            <Text style={styles.systemTag}>&lt;system&gt;</Text>
            <Text style={styles.systemContent}>{formatSystemMessage(item.content)}</Text>
          </View>
        );
      }

      const authorColor = getAuthorColor(item.from ?? "", username);

      return (
        <View style={styles.messageRow}>
          <Text style={styles.timestamp}>[{formatTime(item.ts)}]</Text>
          <Text style={[styles.author, { color: authorColor }]}>{item.from}:</Text>
          <Text style={styles.content}>{item.content}</Text>
        </View>
      );
    },
    [username],
  );

  const listHeader = (
    <View style={styles.systemBanner}>
      <Text style={styles.systemBannerTag}>[SYSTEM]</Text>
      <Text style={styles.systemBannerText}>{systemBannerText(connectionStatus)}</Text>
    </View>
  );

  if (!ready) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>INITIALIZING BUFFER...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status:</Text>
            <Text style={[styles.metaValue, { color: statusColor(connectionStatus) }]}>
              {statusLabel(connectionStatus)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Uptime:</Text>
            <Text style={styles.metaValueMuted}>{uptime}</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          {username ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>User:</Text>
              <Text style={styles.metaValuePrimary}>{username}</Text>
            </View>
          ) : null}
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          style={styles.feed}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No messages in buffer.</Text>
          }
          contentContainerStyle={styles.feedContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onContentSizeChange={() => {
            if (stickToBottomRef.current) {
              scrollToBottom(false);
            }
          }}
        />

        <View
          style={[
            styles.composer,
            { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8) },
          ]}
        >
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="INPUT_COMMAND_OR_MESSAGE..."
              placeholderTextColor={`${theme.outline}80`}
              style={styles.input}
              multiline
              maxLength={2000}
              returnKeyType="default"
              blurOnSubmit={false}
              onFocus={() => {
                stickToBottomRef.current = true;
                scrollToBottom(true);
              }}
              onSubmitEditing={handleSend}
            />
            <Pressable
              style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!draft.trim()}
            >
              <Text style={styles.sendButtonText}>SEND</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
  },
  loadingText: {
    color: theme.onSurfaceVariant,
    fontFamily: fonts.mono,
    ...typography.code,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.outlineVariant,
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  topBarLeft: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaLabel: {
    color: theme.onSurfaceVariant,
    fontFamily: fonts.mono,
    ...typography.code,
  },
  metaValue: {
    fontFamily: fonts.mono,
    fontWeight: "700",
    ...typography.code,
  },
  metaValueMuted: {
    color: theme.onSurfaceVariant,
    fontFamily: fonts.mono,
    ...typography.code,
  },
  metaValuePrimary: {
    color: theme.primary,
    fontFamily: fonts.mono,
    fontWeight: "700",
    ...typography.code,
  },
  logoutButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  logoutText: {
    color: theme.onSurfaceVariant,
    fontFamily: fonts.mono,
    ...typography.label,
    textTransform: "uppercase",
  },
  body: {
    flex: 1,
    backgroundColor: theme.surfaceContainerLowest,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
    flexGrow: 1,
  },
  systemBanner: {
    flexDirection: "row",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${theme.outlineVariant}4D`,
    paddingBottom: 8,
    marginBottom: 12,
    opacity: 0.5,
  },
  systemBannerTag: {
    color: theme.primary,
    fontFamily: fonts.mono,
    ...typography.code,
  },
  systemBannerText: {
    color: theme.onSurface,
    fontFamily: fonts.mono,
    ...typography.code,
    flexShrink: 1,
  },
  emptyText: {
    color: theme.onSurfaceVariant,
    fontFamily: fonts.mono,
    ...typography.code,
    opacity: 0.6,
  },
  messageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  timestamp: {
    color: theme.outline,
    fontFamily: fonts.mono,
    ...typography.code,
  },
  author: {
    fontFamily: fonts.mono,
    fontWeight: "700",
    ...typography.code,
  },
  content: {
    color: theme.onSurface,
    fontFamily: fonts.mono,
    ...typography.code,
    flex: 1,
    flexShrink: 1,
  },
  systemTag: {
    color: theme.stable,
    fontFamily: fonts.mono,
    fontWeight: "700",
    ...typography.code,
  },
  systemContent: {
    color: theme.onSurfaceVariant,
    fontFamily: fonts.mono,
    ...typography.code,
    flex: 1,
    flexShrink: 1,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: theme.outlineVariant,
    backgroundColor: theme.surfaceContainerLow,
    padding: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: theme.onSurface,
    fontFamily: fonts.mono,
    ...typography.code,
    borderRadius: 0,
  },
  sendButton: {
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.background,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: theme.primary,
    fontFamily: fonts.mono,
    fontWeight: "700",
    ...typography.code,
    textTransform: "uppercase",
  },
});
