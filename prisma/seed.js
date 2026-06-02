import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD must be set before running seed.");
  }
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.admin.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash }
  });

  await prisma.plan.upsert({
    where: { id: 1n },
    update: {},
    create: {
      name: "A. 標準方案",
      amount: 1800,
      fortuneIncenseDeductQty: 15,
      jadeIncenseDeductQty: 15,
      goldIngotIncenseDeductQty: 5,
      cycleCount: 1,
      sessionCount: 1
    }
  });

  console.log(`Seeded admin: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
