import { Request, Response, Router } from "express";

import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import { prisma } from "../db";

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req: Request, res: Response) => {
  const token = req.body.token;
  if (!token) res.status(400).json({ error: "No token provided" });

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const googleId = payload.sub;
    const email = payload.email ?? null;

    let user = await prisma.user.findUnique({
      where: { providerId: googleId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          provider: "google",
          providerId: googleId,
          email: email,
        },
      });
    }

    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.json({
      jwt: jwtToken,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.get("/validate", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No auth header" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    return res.sendStatus(200);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
