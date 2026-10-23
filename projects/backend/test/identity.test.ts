import { describe, expect, it } from 'vitest'
import { passwords, hashDatasetPassword } from '../src/modules/identity/infrastructure/passwords.js'
import { registrationSchema } from '../src/modules/identity/index.js'

describe('password credentials', () => {
  it('salts human passwords and verifies correct and incorrect inputs', async () => {
    const first = await passwords.hash('a-user-chosen-password')
    const second = await passwords.hash('a-user-chosen-password')
    expect(first).not.toBe(second)
    expect(first).not.toContain('a-user-chosen-password')
    expect(await passwords.verify('a-user-chosen-password', first)).toBe(true)
    expect(await passwords.verify('incorrect-password', first)).toBe(false)
    expect(await passwords.verify('anything', 'invalid')).toBe(false)
  })
  it('accepts only generated high-entropy secrets for dataset digests', async () => {
    expect(() => hashDatasetPassword('weak-password')).toThrow()
    const secret = 'dataset-' + 'a'.repeat(24)
    expect(await passwords.verify(secret, hashDatasetPassword(secret))).toBe(true)
    expect(await passwords.verify('dataset-' + 'b'.repeat(24), hashDatasetPassword(secret))).toBe(
      false,
    )
  })
  it('normalizes logins, preserves unknowns and rejects extra scope/profile identifiers', () => {
    const input = {
      username: '  Owner_One  ',
      password: 'password-long-enough',
      company: { name: 'Новая компания', industry: 'Металлургия', region: 'Урал' },
    }
    const output = registrationSchema.parse(input)
    expect(output.username).toBe('owner_one')
    expect(output.company.revenue).toBeNull()
    expect(output.company.products.loans).toBeNull()
    expect(() => registrationSchema.parse({ ...input, companyIds: ['U_1'] })).toThrow()
    expect(() =>
      registrationSchema.parse({ ...input, company: { ...input.company, id: 'U_1' } }),
    ).toThrow()
    expect(() => registrationSchema.parse({ ...input, username: 'client_u_1' })).toThrow()
  })
})
