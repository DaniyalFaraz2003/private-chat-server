export type HistoryMessage = {
  id: number;
  username: string;
  content: string;
  created_at: number;
};

export type ChatMessage = {
  id: string;
  kind: "message" | "system";
  from?: string;
  content: string;
  ts: number;
};

export type ServerMessage =
  | { type: "history"; messages: HistoryMessage[] }
  | { type: "message"; from: string; content: string; ts: number; id?: number }
  | { type: "system"; message: string }
  | { type: "error"; message: string };

export function historyToChatMessages(messages: HistoryMessage[]): ChatMessage[] {
  return messages.map((msg) => ({
    id: `history-${msg.id}`,
    kind: "message",
    from: msg.username,
    content: msg.content,
    ts: msg.created_at * 1000,
  }));
}
