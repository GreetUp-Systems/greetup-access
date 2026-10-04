import { z } from "zod";

export const createPurchaseSchema = z
  .object({
    ticketTypeId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();

export const idempotencyKeySchema = z.string().uuid();

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
