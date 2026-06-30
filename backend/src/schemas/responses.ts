import { z } from 'zod'

// safeEncode roda direction:"backward" — ZodTransform lança ZodEncodeError nessa direção,
// então timestamp precisa aceitar Date (Prisma) e string (Redis cache) sem transform
export const timestamp = z.union([z.date(), z.string()])

const errorBody = z.object({ success: z.literal(false), message: z.string() })

export const errors = {
    400: errorBody,
    401: errorBody,
    403: errorBody,
    404: errorBody,
    409: errorBody,
    422: errorBody,
}

export const ok = (shape: z.ZodRawShape) =>
    z.object({ success: z.literal(true), ...shape })

export const deleted = ok({ message: z.string() })
