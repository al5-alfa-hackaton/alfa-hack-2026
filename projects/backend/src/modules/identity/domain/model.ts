import { z } from 'zod'
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_.-]*$/)
export const companyInputSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    industry: z.string().trim().min(2).max(300),
    region: z.string().trim().min(2).max(120),
    revenue: z.number().finite().min(0).max(1e15).nullable().default(null),
    employees: z.number().int().min(1).max(10000000).nullable().default(null),
    products: z
      .object({
        loans: z.boolean().nullable().default(null),
        leasing: z.boolean().nullable().default(null),
        deposits: z.boolean().nullable().default(null),
        payroll: z.boolean().nullable().default(null),
        factoring: z.boolean().nullable().default(null),
        settlement: z.boolean().nullable().default(null),
        guarantees: z.boolean().nullable().default(null),
      })
      .default({
        loans: null,
        leasing: null,
        deposits: null,
        payroll: null,
        factoring: null,
        settlement: null,
        guarantees: null,
      }),
    customsCountries: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
  })
  .strict()
export const registrationSchema = z
  .object({
    username: usernameSchema.refine(
      (value) => !value.startsWith('client_'),
      'Этот префикс логина используется для аккаунтов датасета',
    ),
    password: z.string().min(10).max(128),
    company: companyInputSchema,
  })
  .strict()
export type CompanyInput = z.infer<typeof companyInputSchema>
export type Registration = z.infer<typeof registrationSchema>
export type IdentityRecord = {
  id: string
  username: string
  passwordHash: string
  source: 'dataset' | 'custom'
  companyIds: string[]
}
export type CustomCompany = { id: string; profile: CompanyInput }
