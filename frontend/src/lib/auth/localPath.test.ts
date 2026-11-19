import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localPath } from './localPath.ts'

test('same-site paths pass', () => {
  assert.equal(localPath('/account'), '/account')
  assert.equal(localPath('/cart?x=1#y'), '/cart?x=1#y')
  assert.equal(localPath('  /en/account  '), '/en/account')
})

test('anything that could leave the site is dropped', () => {
  for (const raw of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    'javascript:alert(1)',
    'evil.test',
    '/\t/evil.test',
    '/\n/evil.test',
    '\t//evil.test',
    '',
    undefined,
    null,
    ['/account'],
  ]) {
    assert.equal(localPath(raw), undefined, JSON.stringify(raw))
  }
})
