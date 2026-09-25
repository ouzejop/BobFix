import { openDb } from "./db/connection.js";
import { seed } from "./db/seed.js";
import { createApp } from "./app.js";

const db = openDb("./shoply.db");
seed(db);
const app = createApp(db);

app.listen(3001, () => {
  console.log("Shoply API listening on http://localhost:3001");
});
