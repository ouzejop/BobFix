import { Request, Response } from "express";
import { makeTokenService, InvalidToken, TokenReuseDetected } from "../services/tokenService.js";
import { REFRESH_TOKEN_TTL_DAYS } from "../config.js";
import type { BetterDb } from "../db/connection.js";

export function makeRefreshController(db: BetterDb) {
  const tokenService = makeTokenService(db);

  const refresh = async (req: Request, res: Response): Promise<void> => {
    const oldToken = (req.cookies as Record<string, string>)["rt"];
    if (!oldToken) {
      res.status(401).json({ error: "No refresh token" });
      return;
    }
    try {
      const { access, refresh: newRefresh } = await tokenService.rotate(oldToken);
      res.cookie("rt", newRefresh, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      });
      res.json({ accessToken: access });
    } catch (err) {
      if (err instanceof InvalidToken || err instanceof TokenReuseDetected) {
        res.clearCookie("rt");
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      throw err;
    }
  };

  return { refresh };
}
