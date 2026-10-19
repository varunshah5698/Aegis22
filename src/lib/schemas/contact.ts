import { z } from "zod";

/** Shared primitives keep validation messages consistent across public forms. */
export const emailField = z
  .string()
  .trim()
  .min(1, "Enter your work email.")
  .email("Enter a valid email address.")
  .max(254, "That email address is too long.")
  .transform((value) => value.toLowerCase());

export const honeypotField = z
  .string()
  .max(0, "This field must stay empty.")
  .optional()
  .or(z.literal(""));

export const contactIntents = ["demo", "sales", "support", "other"] as const;

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: emailField,
  company: z.string().trim().max(160).optional().or(z.literal("")),
  intent: z.enum(contactIntents).default("other"),
  message: z
    .string()
    .trim()
    .min(20, "Tell us a little more — at least 20 characters.")
    .max(4000, "Keep the message under 4,000 characters."),
  /** Hidden field. Bots fill it; people never see it. */
  website: honeypotField,
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;

export const newsletterSchema = z.object({
  email: emailField,
  website: honeypotField,
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
