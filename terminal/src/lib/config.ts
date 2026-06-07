export function getServerUrl() {
  return (process.env.SERVER_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

export function getWsUrl() {
  return (process.env.WS_URL ?? "ws://localhost:3001").replace(/\/$/, "");
}
