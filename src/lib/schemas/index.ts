/**
 * Barrel for `@/lib/schemas`.
 *
 * Import-from-here pattern keeps Server Actions and forms terse:
 *
 *   import { CreateBriefInput, BriefId, fromZod } from "@/lib/schemas";
 */

export * from "./base";
export * from "./enums";
export * from "./errors";
export * from "./brief";
