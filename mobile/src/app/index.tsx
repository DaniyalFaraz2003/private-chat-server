import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import LoginForm from "@/components/LoginForm";
import { getToken } from "@/lib/auth-storage";
import { theme } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    getToken().then((token) => {
      if (token) {
        router.replace("/chat");
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.gridOverlay} />
      <View style={styles.main}>
        <LoginForm onSuccess={() => router.replace("/chat")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.08,
    backgroundColor: "#2a3142",
  },
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
