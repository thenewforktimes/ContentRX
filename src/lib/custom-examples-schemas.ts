/**
 * Shared zod schemas for the custom-examples API surface.
 *
 * Split from `custom-examples.ts` so tests, MCP tools, and CLI
 * commands can import the request/response shapes without pulling
 * Drizzle (which would break Edge-runtime consumers if any ever
 * appear).
 *
 * Human-eval build plan Session 30.
 */

import { z } from "zod";
import { CONTENT_TYPES, MOMENTS } from "@/lib/engine-taxonomy";

// Plaintext cap: matches /api/check (100k) so a golden isn't a
// back-door around the content-length ceiling.
export const MAX_EXAMPLE_TEXT_LENGTH = 100_000;
export const MAX_NOTES_LENGTH = 1_000;

export const CreateExampleRequestSchema = z.object({
  text: z.string().min(1).max(MAX_EXAMPLE_TEXT_LENGTH),
  verdict: z.enum(["pass", "violation"]),
  moment: z.enum(MOMENTS).optional(),
  content_type: z.enum(CONTENT_TYPES).optional(),
  // Standard ID is only meaningful for verdict=violation. Validated
  // at the route layer (schema-level cross-field validation gets
  // ugly; a post-parse check is cleaner).
  standard_id: z.string().min(1).max(64).optional(),
  notes: z.string().min(1).max(MAX_NOTES_LENGTH).optional(),
  contribute_upstream: z.boolean().default(false),
});

export type CreateExampleRequest = z.infer<typeof CreateExampleRequestSchema>;

export const UpdateExampleRequestSchema = z.object({
  // The only practically-updatable fields. Text + verdict changes
  // are a new entry (delete + create) so the matching behaviour
  // stays auditable. Notes + contribute_upstream are the two fields
  // teams adjust without changing what the entry matches.
  notes: z.string().max(MAX_NOTES_LENGTH).nullable().optional(),
  contribute_upstream: z.boolean().optional(),
});

export type UpdateExampleRequest = z.infer<typeof UpdateExampleRequestSchema>;
