import { z } from "zod";

export const STAGE_QUESTION_MAX = 600;
export const STAGE_NAME_MAX = 60;

export const stageQuestionSchema = z.object({
  name: z
    .string()
    .trim()
    .max(STAGE_NAME_MAX, `Ad en fazla ${STAGE_NAME_MAX} karakter olabilir.`)
    .optional()
    .transform((v) => (v ? v.replace(/\s+/g, " ") : undefined)),
  question: z
    .string({ error: "Lütfen sorunuzu yazın." })
    .trim()
    .min(3, "Lütfen sorunuzu yazın.")
    .max(STAGE_QUESTION_MAX, `Soru en fazla ${STAGE_QUESTION_MAX} karakter olabilir.`),
  website: z.string().optional(),
});
