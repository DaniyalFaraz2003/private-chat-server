"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/LoginForm";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("chat_token")) {
      router.replace("/chat");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <LoginForm />
    </div>
  );
}
