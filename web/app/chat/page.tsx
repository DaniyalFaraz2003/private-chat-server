"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatRoom from "@/components/ChatRoom";

export default function ChatPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("chat_token")) {
      router.replace("/");
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-code-md text-code-md text-on-surface-variant">
          INITIALIZING BUFFER...
        </p>
      </div>
    );
  }

  return <ChatRoom />;
}
