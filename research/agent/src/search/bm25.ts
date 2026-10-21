const STOP = new Set(
  'и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это также г млн млрд трлн руб года году год'.split(' '),
)

export function tokenize(text: string): string[] {
  return (text.toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (/^\p{N}+$/u.test(t) || t.length <= 5 ? t : t.slice(0, Math.max(5, t.length - 2))))
}

export type Scored<T> = { item: T; score: number }

export class Bm25<T> {
  private docs: { item: T; tf: Map<string, number>; len: number }[] = []
  private df = new Map<string, number>()
  private avgLen = 0

  constructor(items: T[], text: (item: T) => string, private k1 = 1.4, private b = 0.75) {
    for (const item of items) {
      const tokens = tokenize(text(item))
      const tf = new Map<string, number>()
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1)
      this.docs.push({ item, tf, len: tokens.length })
    }
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length)
  }

  search(query: string, limit = 5, filter?: (item: T) => boolean): Scored<T>[] {
    const terms = [...new Set(tokenize(query))]
    const n = this.docs.length
    const results: Scored<T>[] = []
    for (const d of this.docs) {
      if (filter && !filter(d.item)) continue
      let score = 0
      for (const t of terms) {
        const f = d.tf.get(t)
        if (!f) continue
        const df = this.df.get(t) ?? 0
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen))
      }
      if (score > 0) results.push({ item: d.item, score })
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  }
}
