import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

const DEFAULT_KEY_HEX = '52de3126aab366314e92f19563584a331d674aee2914c575e041d6399eda2377'

function getKey(): Buffer {
  let key = process.env.ENCRYPTION_KEY
  if (!key) {
    try {
      const fs = require('fs')
      const path = require('path')
      const envFiles = ['.env', '.env.local', '.env.production']
      for (const file of envFiles) {
        const envPath = path.join(process.cwd(), file)
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8')
          const m = content.match(/ENCRYPTION_KEY=["']?([^"'\r\n]+)/)
          if (m) {
            key = m[1].trim()
            process.env.ENCRYPTION_KEY = key
            break
          }
        }
      }
    } catch {}
  }
  if (!key) {
    key = DEFAULT_KEY_HEX
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(encryptedString: string): string {
  const [ivHex, tagHex, dataHex] = encryptedString.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted string format')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

const ENCRYPTED_PATTERN = /^[0-9a-fA-F]{32}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/

/**
 * Checks if a string has the AES-256-GCM encrypted format (iv:tag:data).
 */
export function isEncrypted(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false
  return ENCRYPTED_PATTERN.test(val.trim())
}

/**
 * Safely encrypts a string. If already encrypted, null, or empty, leaves it untouched.
 * Resilient against runtime configuration issues.
 */
export function safeEncrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext || typeof plaintext !== 'string') return (plaintext as any) ?? null
  const trimmed = plaintext.trim()
  if (!trimmed) return plaintext
  if (isEncrypted(trimmed)) return trimmed
  try {
    return encrypt(trimmed)
  } catch (err: any) {
    console.warn('[Encryption:safeEncrypt] Encryption error, storing raw fallback:', err.message)
    return trimmed
  }
}

/**
 * Safely decrypts a string. If not encrypted, null, or empty, returns as-is.
 * Does not throw on unencrypted legacy data.
 */
export function safeDecrypt(encryptedString: string | null | undefined): string | null {
  if (!encryptedString || typeof encryptedString !== 'string') return (encryptedString as any) ?? null
  const trimmed = encryptedString.trim()
  if (!trimmed) return encryptedString
  if (!isEncrypted(trimmed)) {
    // Unencrypted legacy plaintext - return as-is
    return trimmed
  }
  try {
    return decrypt(trimmed)
  } catch (err: any) {
    console.warn('[Encryption:safeDecrypt] Decryption failed, returning raw string:', err.message)
    return trimmed
  }
}

/**
 * Generates a deterministic hash for search/lookups without exposing plaintext.
 */
export function hashSearchToken(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string') return null
  return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex')
}
