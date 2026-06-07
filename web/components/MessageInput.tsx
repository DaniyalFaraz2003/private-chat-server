"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";

type MessageInputProps = {
  onSend: (content: string) => void;
};

const MAX_HEIGHT = 180;

export default function MessageInput({ onSend }: MessageInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? "scroll" : "hidden";
  }, [content]);

  function submit() {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const canSend = content.trim().length > 0;

  return (
    <footer className="shrink-0 border-t border-outline-variant bg-surface-container-lowest p-md">
      <div className="relative flex flex-col border border-outline-variant transition-colors focus-within:border-primary">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type message to #general..."
          rows={1}
          className="chat-input w-full resize-none border-none bg-background p-md font-code-md text-code-md text-on-surface focus:ring-0"
        />
        <div className="flex items-center justify-between border-t border-outline-variant/30 bg-surface-container-low px-md py-sm">
          <div />
          <div className="flex items-center gap-md">
            <span className="hidden text-hint text-on-surface-variant opacity-60 sm:block">
              Enter to Send, Shift+Enter for New Line
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className="px-md py-sm font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-primary transition-all hover:opacity-80 active:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 bg-primary"
            >
              Transmit
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
