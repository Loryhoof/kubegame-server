import { Request, Response, Router } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const adminPassword = req.headers.authorization?.split(" ")[1];

  if (!adminPassword)
    return res.status(400).json({ error: "No password provided" });

  if (adminPassword !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: "Unauthorized" });

  console.log("requesting users");
  const users = await prisma.user.findMany();
  res.json(users);
});

export default router;
