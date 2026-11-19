import sanitizeHtml from 'sanitize-html'

/**
 * Allowlist sanitiser for CMS rich text (#21). CMS editors are not fully trusted:
 * the body is rendered with `v-html` on the shop's own origin, where a script
 * could act with the shopper's session. Applied at the provider seam (Strapi
 * markdown after `marked`, Prepr `Text.html`) so every renderer gets clean HTML.
 *
 * Prose only: sanitize-html's default tag set (headings, paragraphs, lists,
 * tables, links, emphasis, code, …) plus images. No scripts, styles, iframes,
 * forms or event handlers; links and images only over http(s) (links also
 * mailto/tel), never `javascript:` or protocol-relative.
 *
 * Plain JS so it is testable with `npm run test:server` (src/server/*.test.js).
 */

const OPTIONS = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'title', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    ol: ['start', 'type'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  // A link that opens a new tab can't reach back into the shop's window.
  transformTags: {
    a: (tagName, attribs) =>
      attribs.target === '_blank' ? { tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } } : { tagName, attribs },
  },
}

/** `html` reduced to the prose allowlist; '' for anything that isn't a string. */
export function sanitizeRichText(html) {
  return typeof html === 'string' && html ? sanitizeHtml(html, OPTIONS) : ''
}
