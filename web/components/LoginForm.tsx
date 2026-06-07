"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json()) as { token?: string; error?: string };

      if (!res.ok || !data.token) {
        setError(data.error ?? "AUTH_FAILED");
        return;
      }

      localStorage.setItem("chat_token", data.token);
      localStorage.setItem("chat_username", username);
      router.push("/chat");
    } catch {
      setError("UPLINK_UNREACHABLE");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-[400px] flex-col border border-outline-variant bg-surface-container-low shadow-none"
    >
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
            Username
          </label>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="ROOT_ADMIN"
            required
            className="auth-input w-full border border-outline-variant bg-background px-4 py-2.5 font-code-md text-code-md text-primary placeholder:text-outline transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            className="auth-input w-full border border-outline-variant bg-background px-4 py-2.5 font-code-md text-code-md text-primary placeholder:text-outline transition-colors"
          />
        </div>

        {error ? (
          <p className="font-label-sm text-label-sm uppercase tracking-widest text-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="flex w-full items-center justify-center border border-primary-container bg-primary-container py-4 font-label-sm text-label-sm font-bold tracking-[0.2em] text-white uppercase transition-all duration-150 hover:bg-transparent hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{loading ? "AUTHENTICATING..." : "CONNECT"}</span>
          </button>
        </div>
      </div>

      <div className="flex h-[2px] w-full bg-outline-variant">
        <div className="h-full w-1/3 bg-primary-container" />
      </div>
    </form>
  );
}
