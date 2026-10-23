import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { PasswordHasher } from '../application/ports.js'
const derive = promisify(scrypt)
const digest = (value: string) => createHash('sha256').update(value).digest()
// Only uniformly random, 144-bit seed secrets use a fast digest. User-chosen passwords use scrypt.
export function hashDatasetPassword(secret: string) {
  if (!/^dataset-[A-Za-z0-9_-]{24}$/.test(secret))
    throw new Error('Dataset secret must contain 144 random bits')
  return 'dataset-sha256$' + digest(secret).toString('hex')
}
export const passwords: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(16).toString('hex')
    const hash = (await derive(password, salt, 32)) as Buffer
    return 'scrypt$' + salt + '$' + hash.toString('hex')
  },
  async verify(password, encoded) {
    if (encoded.startsWith('dataset-sha256$')) {
      const expected = Buffer.from(encoded.slice('dataset-sha256$'.length), 'hex')
      return expected.length === 32 && timingSafeEqual(digest(password), expected)
    }
    const parts = encoded.split('$')
    const valid =
      parts.length === 3 &&
      parts[0] === 'scrypt' &&
      /^[a-f0-9]{32}$/.test(parts[1]!) &&
      /^[a-f0-9]{64}$/.test(parts[2]!)
    const salt = valid ? parts[1]! : '0'.repeat(32)
    const actual = (await derive(password, salt, 32)) as Buffer
    const expected = Buffer.from(valid ? parts[2]! : '0'.repeat(64), 'hex')
    return timingSafeEqual(actual, expected) && valid
  },
}
