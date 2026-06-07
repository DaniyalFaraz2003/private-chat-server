import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import LoginForm from "@/components/LoginForm";
import { getToken } from "@/lib/auth-storage";

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
        <ActivityIndicator size="large" color="#18181b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <LoginForm onSuccess={() => router.replace("/chat")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  content: {
    width: "100%",
    alignItems: "center",
  },
});
