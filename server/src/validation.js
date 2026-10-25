import { z } from "zod";
export const email = z.string().trim().toLowerCase().max(100).email();
export const loginSchema = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
export const studentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email,
    phone: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .regex(/^\+?[\d ()-]+$/)
      .refine((v) => {
        const n = v.replace(/\D/g, "").length;
        return n >= 7 && n <= 15;
      }, "Use 7–15 digits"),
    department: z.string().trim().min(1).max(50),
  })
  .strict();
export const idSchema = z.coerce.number().int().positive().max(2147483647);
export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
