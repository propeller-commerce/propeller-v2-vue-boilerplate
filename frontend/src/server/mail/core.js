/**
 * Mail provider interface (JSDoc-typed — this tree is loaded by `server.js`,
 * plain Node ESM, not through Vite).
 *
 * Deliberately not routed through the CMS. `CMS_PROVIDER` may be `none`, and
 * Prepr and Contentful are content APIs with nowhere to host a mailer — so a
 * quote request that depended on the CMS would simply not send for most
 * configurations. The app owns delivery.
 *
 * @typedef {object} MailMessage
 * @property {string[]} to
 * @property {string}   subject
 * @property {string}   text  Plain-text alternative. Always send one.
 * @property {string}   html
 * @property {string}  [replyTo]
 * @property {string[]} [cc]
 * @property {string[]} [bcc]
 *
 * @typedef {object} MailProvider
 * @property {string} name
 * @property {(message: MailMessage) => Promise<void>} send
 */
export {};
