export const theme = {
  background: "#11131a",
  onSurface: "#e1e2ec",
  onSurfaceVariant: "#c3c6d6",
  surface: "#11131a",
  surfaceContainer: "#1d1f26",
  surfaceContainerLow: "#191b22",
  surfaceContainerHigh: "#282a31",
  surfaceContainerLowest: "#0c0e15",
  outlineVariant: "#434653",
  outline: "#8d909f",
  primary: "#b2c5ff",
  primaryContainer: "#5B8CFF",
  onPrimary: "#002c72",
  secondary: "#bfc6dc",
  tertiary: "#ffb874",
  tertiaryContainer: "#d47b00",
  error: "#ffb4ab",
  stable: "#4caf50",
} as const;

export const fonts = {
  mono: "monospace",
  sans: "System",
} as const;

export const type = {
  code: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  hint: { fontSize: 11, lineHeight: 14 },
} as const;
