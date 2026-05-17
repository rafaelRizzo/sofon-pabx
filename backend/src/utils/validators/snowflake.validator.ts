import { z } from 'zod'

export const snowflakeId = (fieldName = 'ID') =>
  z.string().regex(/^\d+$/, `Invalid ${fieldName}`).transform(v => BigInt(v))

export const snowflakeIdObject = (fieldName: string) =>
  z.object({
    [fieldName]: snowflakeId(fieldName.replace(/_/g, ' '))
  })
