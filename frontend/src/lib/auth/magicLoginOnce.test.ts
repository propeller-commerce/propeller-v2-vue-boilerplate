import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onceForToken } from './magicLoginOnce.ts'

test('a remounted view waits for the sign-in already running for its token', async () => {
  let runs = 0
  const signIn = async () => {
    runs++
    await new Promise((r) => setTimeout(r, 5))
    return '/account'
  }
  const [first, second] = await Promise.all([onceForToken('t-1', signIn), onceForToken('t-1', signIn)])
  assert.equal(runs, 1)
  assert.equal(first, '/account')
  assert.equal(second, '/account')
})

test('a failed sign-in is shared too, so the token is not tried again', async () => {
  let runs = 0
  const signIn = async () => {
    runs++
    return null
  }
  assert.equal(await onceForToken('t-2', signIn), null)
  assert.equal(await onceForToken('t-2', signIn), null)
  assert.equal(runs, 1)
})

test('each token signs in on its own', async () => {
  let runs = 0
  const signIn = async () => {
    runs++
    return '/'
  }
  await onceForToken('t-3', signIn)
  await onceForToken('t-4', signIn)
  assert.equal(runs, 2)
})
