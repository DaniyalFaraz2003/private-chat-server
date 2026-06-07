import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { clearSession, getToken, getUsername } from "@/lib/auth-storage";
import type { ChatMessage } from "@/lib/types";
import { historyToChatMessages } from "@/lib/types";
import { connectWS, disconnectWS, sendMessage } from "@/lib/ws";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatRoom() {
  const router = useRouter();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState("");
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);

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
          clearSession().then(() => router.replace("/"));
        }
      });
    }

    bootstrap();

    return () => {
      active = false;
      disconnectWS();
    };
  }, [router]);

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

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
  }, [draft]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.kind === "system") {
      return <Text style={styles.systemMessage}>* {item.content}</Text>;
    }

    return (
      <Text style={styles.message}>
        <Text style={styles.timestamp}>[{formatTime(item.ts)}] </Text>
        <Text style={styles.author}>{item.from}: </Text>
        <Text style={styles.content}>{item.content}</Text>
      </Text>
    );
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Private Chat</Text>
          {username ? (
            <Text style={styles.headerSubtitle}>Signed in as {username}</Text>
          ) : null}
        </View>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted={false}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No messages yet.</Text>
          }
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            style={styles.input}
            multiline
          />
          <Pressable
            style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!draft.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  loadingText: {
    color: "#71717a",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#18181b",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#71717a",
    marginTop: 2,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    fontSize: 14,
    color: "#3f3f46",
  },
  body: {
    flex: 1,
    backgroundColor: "#fff",
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    flexGrow: 1,
  },
  emptyText: {
    color: "#71717a",
    fontSize: 14,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    color: "#71717a",
  },
  author: {
    fontWeight: "600",
    color: "#18181b",
  },
  content: {
    color: "#27272a",
  },
  systemMessage: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#71717a",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#18181b",
    backgroundColor: "#fff",
  },
  sendButton: {
    backgroundColor: "#18181b",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
