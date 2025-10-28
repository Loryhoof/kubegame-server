import { Request, Response, Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import fetch from "node-fetch"; // make sure to install: npm i node-fetch
import { prisma } from "../db";
import { createHash, randomUUID } from "crypto";

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Google OAuth code-based login route
 * Receives an authorization code from the frontend (initCodeClient)
 * Exchanges it for tokens, verifies ID token, and returns a local JWT.
 */
router.post("/google", async (req: Request, res: Response) => {
  console.log("Requesting google (authorization code flow)");

  const code = req.body.token; // frontend sends { token: response.code }
  if (!code)
    return res.status(400).json({ error: "No authorization code provided" });

  try {
    // Exchange authorization code for tokens
    const tokenRes = (await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: "postmessage", // required for popup/JS-based flows
        grant_type: "authorization_code",
      }),
    })) as any;

    const tokenData = await tokenRes.json();
    if (!tokenData.id_token) {
      console.error("Token exchange failed:", tokenData);
      return res.status(401).json({ error: "Token exchange failed" });
    }

    // Verify the ID token we just received
    const ticket = await client.verifyIdToken({
      idToken: tokenData.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid ID token" });

    const googleId = payload.sub;
    const email = payload.email ?? null;

    // Find or create user
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

    console.log("✅ Google login success:", user.email || user.id);

    // Generate local session JWT
    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    return res.json({
      jwt: jwtToken,
      user,
    });
  } catch (err) {
    console.error("❌ Google auth error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
});

router.post("/guest", async (req, res) => {
  // Generate or reuse a device identifier
  const deviceId = req.body.deviceId || randomUUID();
  const deviceHash = createHash("sha256").update(deviceId).digest("hex");

  // Look up existing guest
  let user = await prisma.user.findUnique({ where: { deviceHash } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        provider: "guest",
        isGuest: true,
        deviceHash,
        nickname: `Guest${Math.floor(Math.random() * 9999)}`,
      },
    });
  }

  // Sign a JWT for authentication in your sockets / API
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
    expiresIn: "30d",
  });

  res.json({ token, user, deviceId });
});

/**
 * Validate user JWT
 */
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
