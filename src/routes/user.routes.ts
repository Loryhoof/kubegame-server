import { Request, Response, Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  console.log("Fetching all users (admin)");
  const users = await prisma.user.findMany();
  res.json(users);
});
export default router;
