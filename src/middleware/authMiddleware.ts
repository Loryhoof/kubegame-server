import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    console.log(header, "HEADER");
    if (!header) return res.status(401).json({ error: "No token provided" });

    const token = header.split(" ")[1];
    if (!token)
      return res.status(401).json({ error: "Invalid authorization header" });

    console.log("WE GOT TOKEN!: ", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.admin) return res.status(403).json({ error: "Forbidden" });

    // ✅ Passed all checks
    next();
  } catch (err) {
    console.error("Admin middleware error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
