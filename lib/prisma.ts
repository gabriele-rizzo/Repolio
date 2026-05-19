import "dotenv/config";

import { PrismaClient } from "@/generated/prisma/client";
import { checkEnv } from "@/lib/env";
import { PrismaPg } from "@prisma/adapter-pg";

export const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: checkEnv("DATABASE_URL"),
    }),
});
