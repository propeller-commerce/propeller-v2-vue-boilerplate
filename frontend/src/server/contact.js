import { getMailProvider } from './mail/index.js';
import { detailRow, escapeHtml, renderEmail, sectionHeading } from './mail/template.js';
import { guardForm } from './formGuard.js';

/**
 * CMS contact-form submission. Same contract as the Next and Nuxt apps' equivalents.
 * The recipient is CONTACT_TO_EMAIL only; the visitor is reply-to, never a recipient.
 */

const MAX_NAME = 200;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 5000;

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const oneLine = (s) => s.replace(/[\r\n\t]+/g, ' ');

export function createContactHandler({ getMail = getMailProvider, limiter, verifyCaptcha } = {}) {
  return async function contactHandler(req, res) {
    if (!(await guardForm(req, res, { route: 'contact', action: 'contact', limiter, verifyCaptcha }))) return;

    const body = req.body && typeof req.body === 'object' ? req.body : null;
    if (!body) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }

    const name = oneLine(String(body.name || '').trim());
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();

    if (!name || name.length > MAX_NAME) {
      res.status(400).json({ error: 'A name is required' });
      return;
    }
    if (!email || email.length > MAX_EMAIL || !isEmail(email)) {
      res.status(400).json({ error: 'A valid email is required' });
      return;
    }
    if (!message || message.length > MAX_MESSAGE) {
      res.status(400).json({ error: 'A message is required' });
      return;
    }

    const to = (process.env.CONTACT_TO_EMAIL || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!to.length) {
      console.error('[api/contact] CONTACT_TO_EMAIL is not configured');
      res.status(503).json({ error: 'Recipient not configured' });
      return;
    }

    try {
      await getMail().send({
        to,
        replyTo: email,
        subject: `Contact form - ${name}`,
        text: [`Name: ${name}`, `Email: ${email}`, '', 'Message:', message].join('\n'),
        html: renderEmail({
          title: 'New contact form message',
          body: [
            detailRow('Name', escapeHtml(name)),
            detailRow('Email', `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`),
            sectionHeading('Message'),
            `<p style="margin:0;font-size:15px;line-height:22px;color:#333333;white-space:pre-wrap">${escapeHtml(message)}</p>`,
          ].join(''),
        }),
      });
    } catch (e) {
      console.error('[api/contact] send failed:', e);
      res.status(502).json({ error: 'Failed to send the message' });
      return;
    }

    res.json({ ok: true });
  };
}

export const contactHandler = createContactHandler();
