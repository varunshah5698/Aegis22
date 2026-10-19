import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;

export const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(72, "Passwords longer than 72 characters are not supported.")
  .regex(/[0-9]/, "Include at least one number.")
  .regex(/[^A-Za-z0-9]/, "Include at least one symbol.");

export const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email.")
  .email("Enter a valid email address.")
  .max(254)
  .transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().default(true),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: emailField,
  password: passwordField,
  organizationName: z.string().trim().max(120).optional().or(z.literal("")),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Accept the terms to create an account." }),
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your display name.").max(120),
  timezone: z.string().min(1).max(64),
  mode: z.enum(["create", "join"]),
  organizationName: z.string().trim().max(120).optional().or(z.literal("")),
  inviteToken: z.string().trim().max(200).optional().or(z.literal("")),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** A simple 0-4 strength estimate for the meter, not a security guarantee. */
export function passwordStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  return { score: Math.min(4, score), label: labels[Math.min(4, score)]! };
}
