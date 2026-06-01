import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventStore } from "./store.js";
import { createApp } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.resolve(__dirname, "../events.log");
const PORT = Number(process.env.PORT) || 3000;

const store = new EventStore(LOG_PATH);
store.recover();

const app = createApp(store);

app.listen(PORT, () => {
  console.log(`Event store listening on http://localhost:${PORT}`);
});
