import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkTrackerAuth, isTrackerPath, trackerGate } from './trackerAuth.js'

const basic = (user, pass) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')

test('secret unset or empty fails closed with 404', () => {
  assert.equal(checkTrackerAuth(basic('a', 'x'), undefined).status, 404)
  assert.equal(checkTrackerAuth(basic('a', 'x'), '').status, 404)
})

test('wrong or missing credentials answer 401', () => {
  assert.equal(checkTrackerAuth(undefined, 's3cret').status, 401)
  assert.equal(checkTrackerAuth(basic('a', 'nope'), 's3cret').status, 401)
  assert.equal(checkTrackerAuth(basic('a', 's3cret-longer'), 's3cret').status, 401)
})

test('any username with the right password is allowed', () => {
  assert.equal(checkTrackerAuth(basic('anyone', 's3cret'), 's3cret').status, 200)
  assert.equal(checkTrackerAuth(basic('', 's3cret'), 's3cret').status, 200)
  assert.equal(checkTrackerAuth(basic('a', 'pa:ss'), 'pa:ss').status, 200)
})

test('malformed headers answer 401', () => {
  for (const h of [
    '',
    'Basic',
    'Basic ',
    'Bearer ' + Buffer.from('a:s3cret').toString('base64'),
    'Basic !!!not-base64!!!',
    'Basic ' + Buffer.from('no-colon-s3cret').toString('base64'),
    ['Basic x', 'Basic y'],
  ]) {
    assert.equal(checkTrackerAuth(h, 's3cret').status, 401, String(h))
  }
})

test('scheme is case-insensitive', () => {
  const h = 'basic ' + Buffer.from('a:s3cret').toString('base64')
  assert.equal(checkTrackerAuth(h, 's3cret').status, 200)
})

test('tracker paths cover the page, sub-paths, locale prefixes and the API', () => {
  for (const p of [
    '/tracker',
    '/tracker/',
    '/tracker/x',
    '/en/tracker',
    '/EN/Tracker/x',
    '/TRACKER',
    '//tracker',
    '/%74racker',
    '/api/tracker',
    '/api/tracker/rollup',
    '/api/trackerx',
    '/API/Tracker',
  ]) {
    assert.equal(isTrackerPath(p), true, p)
  }
  for (const p of ['/', '/trackers', '/api/track', '/product/1/tracker-x', '/en/product', '/foo/tracker']) {
    assert.equal(isTrackerPath(p), false, p)
  }
})

function run(path, headers, secret) {
  const prev = process.env.TRACKER_ACCESS_SECRET
  if (secret === undefined) delete process.env.TRACKER_ACCESS_SECRET
  else process.env.TRACKER_ACCESS_SECRET = secret
  const out = { status: null, headers: {}, nextCalled: false }
  const res = {
    status(s) { out.status = s; return this },
    set(k, v) { out.headers[k.toLowerCase()] = v; return this },
    end() { return this },
  }
  try {
    trackerGate({ path, headers }, res, () => { out.nextCalled = true })
  } finally {
    if (prev === undefined) delete process.env.TRACKER_ACCESS_SECRET
    else process.env.TRACKER_ACCESS_SECRET = prev
  }
  return out
}

test('middleware passes non-tracker paths through untouched', () => {
  const r = run('/category/1/x', {}, undefined)
  assert.equal(r.nextCalled, true)
  assert.equal(r.status, null)
})

test('middleware 404s the tracker when the secret is unset', () => {
  const r = run('/api/tracker', { authorization: basic('a', 'x') }, undefined)
  assert.equal(r.nextCalled, false)
  assert.equal(r.status, 404)
})

test('middleware challenges with the Basic realm on bad credentials', () => {
  const r = run('/en/tracker', {}, 's3cret')
  assert.equal(r.nextCalled, false)
  assert.equal(r.status, 401)
  assert.equal(r.headers['www-authenticate'], 'Basic realm="tracker", charset="UTF-8"')
})

test('middleware lets the right password through', () => {
  const r = run('/api/tracker', { authorization: basic('cron', 's3cret') }, 's3cret')
  assert.equal(r.nextCalled, true)
})
