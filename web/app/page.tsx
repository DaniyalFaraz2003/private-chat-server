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
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-20">
        <div className="auth-scanline" />
        <div className="auth-grid absolute inset-0" />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <LoginForm />
      </main>
    </>
  );
}
