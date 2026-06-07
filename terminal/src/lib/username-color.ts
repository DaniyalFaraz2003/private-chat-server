import { theme } from "./theme";

export function getAuthorColor(username: string, currentUser: string): string {
  if (username === currentUser) return theme.primary;

  let hash = 0;
  for (const char of username) {
    hash = (hash + char.charCodeAt(0)) | 0;
  }

  return Math.abs(hash) % 2 === 0 ? theme.secondary : theme.tertiary;
}

export function formatSystemMessage(content: string): string {
  const joinedMatch = content.match(/^(.+) joined$/);
  if (joinedMatch) {
    return `User '${joinedMatch[1]}' has joined the channel.`;
  }

  const leftMatch = content.match(/^(.+) left$/);
  if (leftMatch) {
    return `User '${leftMatch[1]}' has left the channel.`;
  }

  return content;
}
