import { Request, Response } from "express";
import type { BetterDb } from "../db/connection.js";

export function makeShopController(db: BetterDb) {
  const me = (req: Request, res: Response): void => {
    const userId = (req as Request & { userId: number }).userId;
    const user = db
      .prepare<[number], { id: number; email: string; name: string }>(
        "SELECT id, email, name FROM users WHERE id = ?"
      )
      .get(userId);
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(user);
  };

  const orders = (req: Request, res: Response): void => {
    const userId = (req as Request & { userId: number }).userId;
    const rows = db
      .prepare<[number], { id: number; total_cents: number; status: string; created_at: number }>(
        "SELECT id, total_cents, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC"
      )
      .all(userId);
    res.json(rows);
  };

  const cart = (req: Request, res: Response): void => {
    const userId = (req as Request & { userId: number }).userId;
    const rows = db
      .prepare<[number], { id: number; product: string; qty: number }>(
        "SELECT id, product, qty FROM cart_items WHERE user_id = ?"
      )
      .all(userId);
    res.json(rows);
  };

  return { me, orders, cart };
}
