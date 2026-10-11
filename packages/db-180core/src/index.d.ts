import { PrismaClient } from '../generated/client';
export * from '../generated/client';
export declare const corePrisma: PrismaClient<import("../generated/client").Prisma.PrismaClientOptions, never, import("@workspace/db-180core/generated/client/runtime/library").DefaultArgs>;
export declare const db180core: PrismaClient<import("../generated/client").Prisma.PrismaClientOptions, never, import("@workspace/db-180core/generated/client/runtime/library").DefaultArgs>;
export declare const developersPrisma: PrismaClient<import("../generated/client").Prisma.PrismaClientOptions, never, import("@workspace/db-180core/generated/client/runtime/library").DefaultArgs>;
export default corePrisma;
