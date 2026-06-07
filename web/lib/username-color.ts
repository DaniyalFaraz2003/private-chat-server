const AUTHOR_COLORS = ["text-secondary", "text-tertiary"] as const;

export function getAuthorColorClass(username: string, currentUser: string): string {
  if (username === currentUser) return "text-primary";

  let hash = 0;
  for (const char of username) {
    hash = (hash + char.charCodeAt(0)) | 0;
  }

  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length] ?? "text-secondary";
}

export function formatSystemMessage(content: string): string {
  const joinedMatch = content.match(/^(.+) joined$/);
  if (joinedMatch) {
    return `> USER [${joinedMatch[1]}] joined the server`;
  }

  const leftMatch = content.match(/^(.+) left$/);
  if (leftMatch) {
    return `> USER [${leftMatch[1]}] left the server`;
  }

  return `> ${content}`;
}
