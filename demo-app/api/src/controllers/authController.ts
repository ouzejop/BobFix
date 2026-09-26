import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { makeUserRepo } from "../db/userRepo.js";
import { makeTokenService } from "../services/tokenService.js";
import { REFRESH_TOKEN_TTL_DAYS } from "../config.js";
import type { BetterDb } from "../db/connection.js";

export function makeAuthController(db: BetterDb) {
  const users = makeUserRepo(db);
  const tokenService = makeTokenService(db);

  const login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email: string; password: string };
    const user = users.findByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const { access, refresh } = await tokenService.issueForLogin(user);
    res.cookie("rt", refresh, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken: access });
  };

  const logout = (_req: Request, res: Response): void => {
    res.clearCookie("rt");
    res.status(204).end();
  };

  return { login, logout };
}
