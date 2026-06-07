export const theme = {
  background: "#11131a",
  onSurface: "#e1e2ec",
  onSurfaceVariant: "#c3c6d6",
  surfaceContainerLow: "#191b22",
  surfaceContainerHigh: "#282a31",
  surfaceContainerLowest: "#0c0e15",
  outlineVariant: "#434653",
  outline: "#8d909f",
  primary: "#b2c5ff",
  primaryContainer: "#5B8CFF",
  tertiaryContainer: "#d47b00",
  error: "#ffb4ab",
  stable: "#4caf50",
} as const;

export function getServerLabel(url?: string) {
  if (!url) return "localhost:3001";
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "");
  }
}
