import { useState } from "react";

import ChatScreen from "@/components/ChatScreen";
import LoginScreen from "@/components/LoginScreen";
import type { Session } from "@/lib/types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return <ChatScreen session={session} onLogout={() => setSession(null)} />;
}
