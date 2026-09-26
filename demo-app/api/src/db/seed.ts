import bcrypt from "bcryptjs";
import type { BetterDb } from "./connection.js";

const USERS = [
  { email: "alice@shoply.test", name: "Alice" },
  { email: "bob@shoply.test", name: "Bob" },
  { email: "carol@shoply.test", name: "Carol" },
];

export function seed(db: BetterDb): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, name) VALUES (?, ?, ?)"
  );

  for (const u of USERS) {
    const hash = bcrypt.hashSync("demo1234", 10);
    insert.run(u.email, hash, u.name);
  }

  const alice = db
    .prepare<[string], { id: number }>("SELECT id FROM users WHERE email = ?")
    .get("alice@shoply.test");

  if (alice) {
    db.prepare("INSERT OR IGNORE INTO orders (user_id, total_cents, status, created_at) VALUES (?, ?, ?, ?)").run(alice.id, 4999, "shipped", Date.now());
    db.prepare("INSERT OR IGNORE INTO orders (user_id, total_cents, status, created_at) VALUES (?, ?, ?, ?)").run(alice.id, 1299, "pending", Date.now());
    db.prepare("INSERT OR IGNORE INTO cart_items (user_id, product, qty) VALUES (?, ?, ?)").run(alice.id, "Widget Pro", 2);
    db.prepare("INSERT OR IGNORE INTO cart_items (user_id, product, qty) VALUES (?, ?, ?)").run(alice.id, "Gadget Lite", 1);
  }
}
