import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export function toJson(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? Number(item) : item
    )
  );
}

export function idParam(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error("Invalid id");
    error.status = 400;
    throw error;
  }
  return BigInt(parsed);
}

export function dateValue(value) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    const error = new Error("Invalid date");
    error.status = 400;
    throw error;
  }
  return date;
}
