/**
 * SQLite adapter using Node 22's built-in node:sqlite (DatabaseSync).
 * Exposes a better-sqlite3-compatible subset:
 *   db.pragma(str), db.exec(sql),
 *   db.prepare(sql) → { get, all, run },
 *   db.transaction(fn) → () => result
 */
import { createRequire } from "node:module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use createRequire to load node:sqlite so that Vite/Vitest resolvers
// do not attempt to bundle this experimental Node 22 built-in module.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
type StatementSync = ReturnType<InstanceType<typeof DatabaseSync>["prepare"]>;

// Minimal type that matches the better-sqlite3 usage surface in this project.
export interface BetterDb {
  pragma(pragma: string): void;
  exec(sql: string): void;
  prepare<P = unknown[], R = Record<string, unknown>>(sql: string): BetterStmt<P, R>;
  transaction<T>(fn: () => T): () => T;
}

export interface BetterStmt<_P, R> {
  get(...args: unknown[]): R | undefined;
  all(...args: unknown[]): R[];
  run(...args: unknown[]): { changes: number };
}

function wrap(raw: InstanceType<typeof DatabaseSync>): BetterDb {
  return {
    pragma(str: string) {
      raw.exec(`PRAGMA ${str}`);
    },
    exec(sql: string) {
      raw.exec(sql);
    },
    prepare<P = unknown[], R = Record<string, unknown>>(sql: string): BetterStmt<P, R> {
      const stmt: StatementSync = raw.prepare(sql);
      return {
        get(...args: unknown[]): R | undefined {
          const row = stmt.get(...args) as R | undefined;
          return row;
        },
        all(...args: unknown[]): R[] {
          return stmt.all(...args) as R[];
        },
        run(...args: unknown[]): { changes: number } {
          const r = stmt.run(...args) as { changes: number };
          return { changes: r.changes ?? 0 };
        },
      };
    },
    transaction<T>(fn: () => T): () => T {
      return () => {
        raw.exec("BEGIN IMMEDIATE");
        try {
          const result = fn();
          raw.exec("COMMIT");
          return result;
        } catch (err) {
          try { raw.exec("ROLLBACK"); } catch {}
          throw err;
        }
      };
    },
  };
}

export function openDb(path: string): BetterDb {
  const raw = new DatabaseSync(path);
  const db = wrap(raw);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const migration = readFileSync(
    join(__dirname, "migrations", "001_init.sql"),
    "utf8"
  );
  db.exec(migration);
  return db;
}
