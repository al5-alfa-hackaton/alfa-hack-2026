import test from "node:test";
import assert from "node:assert/strict";
import {
  answerQuestion,
  companies,
  delay,
  news,
  rankedNews,
  runAnalysis,
  scopeKey,
} from "../src/features/demo/model.ts";

test("same corpus is ranked differently for two company profiles", () => {
  const metal = rankedNews("nord", "cfo"),
    retail = rankedNews("retail", "cfo");
  assert.equal(metal[0]?.id, "rate");
  assert.equal(retail[0]?.id, "demand");
  assert.deepEqual(
    new Set(metal.map((n) => n.id)),
    new Set(retail.map((n) => n.id)),
  );
  assert.notEqual(
    metal[0]?.context.nord.impact,
    metal[0]?.context.retail.impact,
  );
});
test("role affects priority and next-action explanation", () => {
  assert.notEqual(
    rankedNews("nord", "cfo")[0]?.id,
    rankedNews("nord", "ceo")[0]?.id,
  );
  const item = news[0]!;
  assert.match(answerQuestion("Что сделать?", item, "nord", "cfo"), /CFO/);
  assert.match(
    answerQuestion("Что сделать?", item, "nord", "ceo"),
    /стратегию/,
  );
});
test("every news item has explanations for both companies, unknown data remain explicit", () => {
  for (const item of news)
    for (const id of ["nord", "retail"] as const) {
      assert.ok(item.context[id].reason);
      assert.ok(item.context[id].action);
      assert.match(
        answerQuestion("Какие риски?", item, id, "cfo"),
        new RegExp(
          companies[id].missing.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      );
    }
});
test("unsupported questions are not answered with invented facts", () => {
  assert.match(
    answerQuestion("Сколько заработаем завтра?", news[0]!, "nord", "cfo"),
    /не могу достоверно/,
  );
});
test("saved items, feedback and chats are scoped to company and role", () => {
  assert.notEqual(
    scopeKey("nord", "cfo", "rate"),
    scopeKey("retail", "cfo", "rate"),
  );
  assert.notEqual(
    scopeKey("nord", "cfo", "rate"),
    scopeKey("nord", "ceo", "rate"),
  );
});
test("success, partial and empty states complete all four steps", async () => {
  for (const [scenario, result] of [
    ["normal", "complete"],
    ["partial", "partial"],
    ["empty", "empty"],
  ] as const) {
    const progress: number[] = [];
    assert.equal(
      await runAnalysis(
        scenario,
        new AbortController().signal,
        (s) => progress.push(s),
        1,
      ),
      result,
    );
    assert.deepEqual(progress, [0, 1, 2, 3]);
  }
});
test("service, budget and access failures do not publish a completed analysis", async () => {
  for (const scenario of ["error", "budget", "denied"] as const) {
    const progress: number[] = [];
    await assert.rejects(
      runAnalysis(
        scenario,
        new AbortController().signal,
        (s) => progress.push(s),
        1,
      ),
      { message: scenario },
    );
    assert.deepEqual(progress, [0, 1]);
  }
});
test("cancelling a running analysis stops further steps", async () => {
  const ac = new AbortController(),
    progress: number[] = [];
  const pending = runAnalysis(
    "normal",
    ac.signal,
    (s) => {
      progress.push(s);
      if (s === 1) ac.abort();
    },
    1,
  );
  await assert.rejects(pending, { name: "AbortError" });
  assert.deepEqual(progress, [0, 1]);
});
test("an already cancelled request rejects immediately", async () => {
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(delay(1000, ac.signal), { name: "AbortError" });
});
