import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto'
import { validateEnv } from '../config/env'

// Segredo próprio de terceiro (ex: token de API do IXCsoft, ver IxcCredential) - primeiro dado
// deste projeto que precisa de criptografia real em repouso (campos legados como Trunk.password/
// Company.elevenLabsApiKey são texto puro, não seguir esse padrão aqui). Chave derivada por empresa
// via HKDF a partir de uma master key só em env: comprometer a chave de uma empresa nunca expõe as
// demais, sem precisar de um KMS externo.
const ALGORITHM = 'aes-256-gcm'

function deriveCompanyKey(companyId: string): Buffer {
    const { ENCRYPTION_MASTER_KEY } = validateEnv()
    return Buffer.from(hkdfSync('sha256', ENCRYPTION_MASTER_KEY, companyId, 'ixc-credential', 32))
}

export type EncryptedField = { ciphertext: string; iv: string; tag: string }

export function encryptForCompany(companyId: string, plaintext: string): EncryptedField {
    const key = deriveCompanyKey(companyId)
    const iv = randomBytes(12)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
}

export function decryptForCompany(companyId: string, field: EncryptedField): string {
    const key = deriveCompanyKey(companyId)
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(field.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(field.tag, 'base64'))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(field.ciphertext, 'base64')), decipher.final()])
    return plaintext.toString('utf8')
}
