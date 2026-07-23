import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton across hot reloads in dev (Fluid Compute reuses warm instances in
// prod anyway — docs/03-architecture.md §3.4) to avoid exhausting Postgres
// connections. Standard `pg` driver works against Neon's direct TCP endpoint;
// see docs/07-tech-stack.md §7.2.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
