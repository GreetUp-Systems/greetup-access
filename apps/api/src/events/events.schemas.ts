import { z } from "zod";

const maxInteger = 2_147_483_647;

const text = (max: number) => z.string().trim().min(1).max(max);
const positiveInteger = z.number().int().min(1).max(maxInteger);
const startsAt = z.string().datetime({ offset: true });

function hasAtLeastOneField(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

export const createEventSchema = z
  .object({
    name: text(120),
    description: text(5_000).optional(),
    location: text(200).optional(),
    startsAt,
    capacity: positiveInteger,
    refundPolicy: text(2_000).optional(),
  })
  .strict();

export const updateEventSchema = z
  .object({
    name: text(120).optional(),
    description: text(5_000).nullable().optional(),
    location: text(200).nullable().optional(),
    startsAt: startsAt.optional(),
    capacity: positiveInteger.optional(),
    refundPolicy: text(2_000).nullable().optional(),
  })
  .strict()
  .refine(hasAtLeastOneField);

export const createTicketTypeSchema = z
  .object({
    name: text(80),
    description: text(500).optional(),
    priceCents: positiveInteger,
    quantity: positiveInteger,
  })
  .strict();

export const updateTicketTypeSchema = z
  .object({
    name: text(80).optional(),
    description: text(500).nullable().optional(),
    priceCents: positiveInteger.optional(),
    quantity: positiveInteger.optional(),
  })
  .strict()
  .refine(hasAtLeastOneField);

export const listEventsQuerySchema = z
  .object({
    status: z.enum(["draft", "published", "cancelled"]).optional(),
  })
  .strict();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
