import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import App from "./App";
import { disconnectWS } from "./lib/ws";

const renderer = await createCliRenderer({ exitOnCtrlC: true });
const root = createRoot(renderer);

root.render(<App />);

renderer.on("exit", () => {
  disconnectWS();
  process.exit(0);
});
