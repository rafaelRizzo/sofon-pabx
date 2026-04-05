import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ENCRYPTION_KEY: string = process.env.ENCRYPTION_KEY || 'seu-encryption-key-aqui-min-32-chars'

function getKey(): Buffer {
    if (ENCRYPTION_KEY.length < 32) {
        return scryptSync(ENCRYPTION_KEY, 'salt', 32)
    }
    return Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf-8')
}

export function encrypt(data: Record<string, unknown>): string {
    const iv: Buffer = randomBytes(16)
    const cipher = createCipheriv('aes-256-cbc', getKey(), iv)

    const jsonString: string = JSON.stringify(data)
    let encrypted: string = cipher.update(jsonString, 'utf-8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
}

export function decrypt(encryptedData: string): Record<string, unknown> {
    const parts: string[] = encryptedData.split(':')
    const ivHex: string = parts[0]!
    const encrypted: string = parts[1]!
    const iv: Buffer = Buffer.from(ivHex, 'hex')

    const decipher = createDecipheriv('aes-256-cbc', getKey(), iv)

    let decrypted: string = decipher.update(encrypted, 'hex', 'utf-8')
    decrypted += decipher.final('utf-8')

    return JSON.parse(decrypted)
}