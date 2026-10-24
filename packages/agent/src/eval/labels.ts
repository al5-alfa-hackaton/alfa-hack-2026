export type ExpertPair = { grades: Record<string, number>; roles: Record<string, string[]>; comments: Record<string, string> }
export type ExpertLabels = { pairs: Record<string, ExpertPair> }

export function agreement(pairs: [number, number][]): { n: number; exact: number; withinOne: number; kappa: number } {
  const n = pairs.length
  if (!n) return { n: 0, exact: 0, withinOne: 0, kappa: 0 }
  const exact = pairs.filter(([a, b]) => a === b).length / n
  const withinOne = pairs.filter(([a, b]) => Math.abs(a - b) <= 1).length / n
  const weight = (a: number, b: number) => 1 - Math.abs(a - b) / 2
  const observed = pairs.reduce((s, [a, b]) => s + weight(a, b), 0) / n
  const share = (i: 0 | 1, g: number) => pairs.filter((p) => p[i] === g).length / n
  let expected = 0
  for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) expected += share(0, a) * share(1, b) * weight(a, b)
  const kappa = expected === 1 ? 1 : (observed - expected) / (1 - expected)
  return { n, exact, withinOne, kappa }
}

export function expertGrade(pair: ExpertPair | undefined): number | undefined {
  const grades = pair ? Object.values(pair.grades) : []
  if (!grades.length) return undefined
  const sorted = [...grades].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

export function expertRoles(pair: ExpertPair | undefined): string[] | undefined {
  const all = pair ? Object.values(pair.roles).filter((r) => r.length) : []
  if (!all.length) return undefined
  return ['cfo', 'ceo'].filter((role) => all.filter((r) => r.includes(role)).length * 2 >= all.length)
}
