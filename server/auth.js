import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db.js";

const SESSION_DAYS = 7;

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(adminId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: hashToken(token),
      expiresAt
    }
  });
  return { token, expiresAt };
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { admin: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.admin = session.admin;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
