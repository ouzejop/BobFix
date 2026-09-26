import express from "express";
import cookieParser from "cookie-parser";
import type { BetterDb } from "./db/connection.js";
import { makeAuthController } from "./controllers/authController.js";
import { makeRefreshController } from "./controllers/refreshController.js";
import { makeShopController } from "./controllers/shopController.js";
import { makeAuthMiddleware } from "./middleware/authMiddleware.js";

export function createApp(db: BetterDb) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const auth = makeAuthController(db);
  const refresh = makeRefreshController(db);
  const shop = makeShopController(db);
  const authMiddleware = makeAuthMiddleware(db);

  app.post("/auth/login", auth.login);
  app.post("/auth/logout", auth.logout);
  app.post("/auth/refresh", refresh.refresh);

  app.get("/me", authMiddleware, shop.me);
  app.get("/orders", authMiddleware, shop.orders);
  app.get("/cart", authMiddleware, shop.cart);

  return app;
}
