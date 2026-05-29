import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured.");
    }

    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    globalForPrisma.prisma = new PrismaClient({
      adapter,
    });
  }

  return globalForPrisma.prisma;
}
