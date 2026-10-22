import test from 'node:test'
import assert from 'node:assert/strict'
import { featureLabel, relevanceReason } from '../src/entities/company/model.ts'

test('feature codes have natural Russian labels and relevance messages', () => {
  const features = [
    'industry',
    'group_industries',
    'supplier_industries',
    'customer_industries',
    'loans',
    'leasing',
    'guarantees',
    'deposits',
    'factoring',
    'payroll',
    'customs',
    'revenue',
    'region',
  ]
  for (const id of features) {
    assert.match(featureLabel(id), /[А-Яа-яЁё]/)
    assert.match(relevanceReason(id), /[А-Яа-яЁё]/)
    assert.ok(!featureLabel(id).includes(id))
    assert.ok(!relevanceReason(id).includes(id))
  }
  assert.equal(featureLabel('leasing'), 'Лизинг')
  assert.equal(relevanceReason('leasing'), 'Связано с лизингом вашей компании')
})

test('unknown codes use safe readable fallbacks instead of technical IDs', () => {
  assert.equal(featureLabel('new_feature'), 'Особенности компании')
  assert.equal(featureLabel('new_feature', 'Дополнительный признак'), 'Дополнительный признак')
  assert.equal(featureLabel('new_feature', 'new_feature'), 'Особенности компании')
  assert.equal(relevanceReason('new_feature'), 'Связано с особенностями вашей компании')
})
