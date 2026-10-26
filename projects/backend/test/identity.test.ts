import { describe, expect, it } from 'vitest'
import { registrationSchema } from '../src/modules/identity/index.js'

describe('passwordless company profiles', () => {
  it('normalizes profile names, preserves unknowns and rejects injected scope identifiers', () => {
    const input = {
      username: '  Owner_One  ',
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
    expect(() => registrationSchema.parse({ ...input, password: 'unused-password' })).toThrow()
  })
})
