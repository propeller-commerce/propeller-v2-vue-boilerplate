import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marked } from 'marked'
import { sanitizeRichText } from './sanitizeRichText.js'

const noScript = (html) => !/<script|onerror|onload|onclick|javascript:/i.test(html)

test('scripts, event handlers and javascript: links are removed (#21)', () => {
  for (const evil of [
    '<img src="x" onerror="alert(document.cookie)">',
    '<script>fetch("/api/graphql")</script><p>hi</p>',
    '<a href="javascript:alert(1)">click</a>',
    '<a href="JaVaScRiPt:alert(1)">click</a>',
    '<a href="  javascript:alert(1)">click</a>',
    '<p onclick="alert(1)">x</p>',
    '<svg onload="alert(1)"><circle/></svg>',
    '<iframe src="https://evil.test"></iframe>',
    '<style>body{display:none}</style>',
    '<form action="https://evil.test"><input name="p"></form>',
    '<img src="javascript:alert(1)">',
  ]) {
    const out = sanitizeRichText(evil)
    assert.ok(noScript(out), `${evil} → ${out}`)
    assert.ok(!/<(iframe|style|form|input|svg|script)/i.test(out), `${evil} → ${out}`)
  }
  assert.equal(sanitizeRichText('<img src="x" onerror="alert(1)">'), '<img src="x" />')
  assert.equal(sanitizeRichText('<a href="javascript:alert(1)">click</a>'), '<a>click</a>')
})

test('raw HTML inside Strapi markdown is cleaned after marked renders it', () => {
  const html = marked.parse('# Title\n\nText <img src=x onerror=alert(1)> and [x](javascript:alert(1))\n\n<script>alert(1)</script>', {
    async: false,
  })
  const out = sanitizeRichText(html)
  assert.ok(noScript(out), out)
  assert.match(out, /<h1>Title<\/h1>/)
})

test('ordinary prose survives', () => {
  const prose =
    '<h2>Delivery</h2><p>We ship <strong>daily</strong>, see <a href="https://shop.test/terms" title="Terms">terms</a> or <a href="mailto:info@shop.test">mail us</a>.</p>' +
    '<ul><li>one</li><li><em>two</em></li></ul><blockquote>quote</blockquote>' +
    '<table><thead><tr><th colspan="2">Size</th></tr></thead><tbody><tr><td>S</td><td>M</td></tr></tbody></table>' +
    '<img src="https://cdn.shop.test/a.png" alt="A" width="100">'
  assert.equal(sanitizeRichText(prose), prose.replace('width="100">', 'width="100" />'))
})

test('new-tab links get rel=noopener; protocol-relative links are dropped', () => {
  assert.equal(
    sanitizeRichText('<a href="https://x.test" target="_blank">x</a>'),
    '<a href="https://x.test" target="_blank" rel="noopener noreferrer">x</a>',
  )
  assert.equal(sanitizeRichText('<a href="//evil.test">x</a>'), '<a>x</a>')
})

test('non-strings become empty', () => {
  assert.equal(sanitizeRichText(undefined), '')
  assert.equal(sanitizeRichText(null), '')
  assert.equal(sanitizeRichText(42), '')
})
