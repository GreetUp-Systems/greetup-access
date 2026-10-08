import { z } from "zod";

import { coverContentTypes } from "./event-cover";
import { eventCategories } from "./events.types";

const maxInteger = 2_147_483_647;

const text = (max: number) => z.string().trim().min(1).max(max);
const positiveInteger = z.number().int().min(1).max(maxInteger);
const startsAt = z.string().datetime({ offset: true });
const endsAt = z.string().datetime({ offset: true });
const category = z.enum(eventCategories);
// IBGE municipality codes have seven digits.
const cityCode = z.number().int().min(1_000_000).max(9_999_999);

function hasAtLeastOneField(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

export const createEventSchema = z
  .object({
    name: text(120),
    description: text(5_000).optional(),
    category: category.optional(),
    venueName: text(120).optional(),
    cityCode: cityCode.optional(),
    address: text(200).optional(),
    startsAt,
    endsAt: endsAt.optional(),
    capacity: positiveInteger,
    refundPolicy: text(2_000).optional(),
  })
  .strict();

export const updateEventSchema = z
  .object({
    name: text(120).optional(),
    description: text(5_000).nullable().optional(),
    // Category and city are replaced, never cleared: a published event keeps both.
    category: category.optional(),
    venueName: text(120).nullable().optional(),
    cityCode: cityCode.optional(),
    address: text(200).nullable().optional(),
    startsAt: startsAt.optional(),
    endsAt: endsAt.nullable().optional(),
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

export const coverUploadSchema = z.object({ contentType: z.enum(coverContentTypes) }).strict();

export const setCoverSchema = z.object({ key: z.string().min(1).max(200) }).strict();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
