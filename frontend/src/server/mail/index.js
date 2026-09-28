import { createSmtpProvider } from './providers/smtp.js';

/**
 * Resolve the active mail provider from MAIL_PROVIDER. Defaults to 'smtp'.
 * Add HTTP-API providers (Resend, Mailjet REST, SendGrid) beside smtp.
 */

/**
 * No-op provider when mail is switched off. Throws rather than silently
 * discarding: a request the shopper believes was sent, that never arrives, is
 * worse than a visible error.
 *
 * @returns {import('./core.js').MailProvider}
 */
function createNoneProvider() {
  return {
    name: 'none',
    async send() {
      throw new Error('MAIL_PROVIDER is "none" — no mail was sent');
    },
  };
}

function createProvider() {
  const provider = process.env.MAIL_PROVIDER || 'smtp';
  switch (provider) {
    case 'none':
      return createNoneProvider();
    case 'smtp':
      return createSmtpProvider();
    default:
      throw new Error(`Unknown mail provider: "${provider}". Supported: none, smtp`);
  }
}

let cached = null;

/** The active provider, built once per server process. */
export function getMailProvider() {
  if (!cached) cached = createProvider();
  return cached;
}
