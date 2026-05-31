import { PrismaClient } from "@/generated/prisma/client";
import { checkEnv } from "@/lib/env";
import { PrismaPg } from "@prisma/adapter-pg";

const createPrismaClient = () =>
    new PrismaClient({
        adapter: new PrismaPg({ connectionString: checkEnv("DATABASE_URL") }),
    });

// Reuse a single client across HMR reloads in dev and warm serverless invocations
// to avoid exhausting database connections.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
