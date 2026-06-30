import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email address is required.")
    .email("Please enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password should contain 8 - 64 characters")
    .max(64, "Password should contain 8 - 64 characters")
    .regex(/[A-Z]/, "Password should contain at least one uppercase letter")
    .regex(/[a-z]/, "Password should contain at least one lowercase letter")
    .regex(/[0-9]/, "Password should contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password should contain at least one special character",
    ),
  tosAccepted: z.literal(true, {
    error: "You must agree to the Terms of Service to create an account.",
  }),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
