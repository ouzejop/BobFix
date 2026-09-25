import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/tokenService.js";
import { makeRefreshTokenRepo } from "../db/refreshTokenRepo.js";
import Database from "better-sqlite3";

export function makeAuthMiddleware(db: Database.Database) {
  const repo = makeRefreshTokenRepo(db);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = auth.slice(7);
    try {
      const payload = await verifyAccessToken(token);
      const fid = payload["fid"] as string | undefined;
      if (!fid || repo.isFamilyRevoked(fid)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      (req as Request & { userId: number }).userId = Number(payload.sub);
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
