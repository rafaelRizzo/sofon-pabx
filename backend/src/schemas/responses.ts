import { z } from 'zod'

// Zod v4 cuid2 regex lacks minimum length - use explicit pattern to reject short strings like 'invalid'
export const cuidParam = z.string().regex(/^[0-9a-z]{24,}$/)

// safeEncode roda direction:"backward" - ZodTransform lança ZodEncodeError nessa direção,
// então timestamp precisa aceitar Date (Prisma) e string (ex: JSON já serializado) sem transform
export const timestamp = z.union([z.date(), z.string()])

const errorBody = z.object({
    success: z.literal(false),
    message: z.string(),
    errors: z.array(z.record(z.string(), z.unknown())).optional(),
})

export const errors = {
    400: errorBody,
    401: errorBody,
    403: errorBody,
    404: errorBody,
    409: errorBody,
    413: errorBody,
    422: errorBody,
}

export const ok = <T extends z.ZodRawShape>(shape: T) =>
    z.object({ success: z.literal(true), ...shape })

export const deleted = ok({ message: z.string() })
