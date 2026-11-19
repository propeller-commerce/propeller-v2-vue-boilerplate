import {
  GraphQLClient,
  ProductService,
  CategoryService,
  CartService,
  OrderService,
  type GraphQLClientConfig,
} from '@propeller-commerce/propeller-sdk-v2'
import { createServices } from '@propeller-commerce/propeller-v2-vue-ui'

// Proxy mode: server.js injects the API key; the browser never holds one.
const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || '/api/graphql'

// ── Session ────────────────────────────────────────────────────────────────
// The session lives in httpOnly cookies set by the server (POST/DELETE
// /api/auth/session); the /api/graphql proxy turns the cookie into the upstream
// Bearer. Browser code never stores or reads a token, so a script injected into
// the page can't carry the session off.

let sessionWrite: Promise<unknown> = Promise.resolve()

function sessionRequest(method: 'POST' | 'DELETE', body?: object, query = ''): Promise<unknown> {
  return fetch(`/api/auth/session${query}`, {
    method,
    keepalive: true,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  }).catch(() => undefined)
}

/** Hand the tokens a login just returned to the server, which keeps them in httpOnly cookies. */
export function startSession(accessToken: string, refreshToken?: string): Promise<unknown> {
  return (sessionWrite = sessionRequest('POST', { accessToken, refreshToken }))
}

/**
 * Drop the session cookies (logout), with the last-order, registration and punchout
 * cookies. `keepPunchoutPending`: magic-login, right before the token exchange that
 * activates the pending punchout entry.
 */
export function endSession({ keepPunchoutPending = false } = {}): Promise<unknown> {
  return (sessionWrite = sessionRequest('DELETE', undefined, keepPunchoutPending ? '?keep=punchout-pending' : ''))
}

/**
 * The SDK client, with its token hooks pointed at the session cookies. The
 * package's login, magic-login and registration flows call `setAccessToken`
 * with the token they just received and then query as that user; the base
 * class would put it in localStorage.
 */
class SessionGraphQLClient extends GraphQLClient {
  override setAccessToken(token: string): void {
    if (token) void startSession(token)
    else void endSession()
  }

  override clearAccessToken(): void {
    void endSession()
  }
}

const clientConfig: GraphQLClientConfig = {
  endpoint,
  timeout: parseInt(import.meta.env.VITE_TIMEOUT || '30000', 10),
  headers: {},
  // No Authorization header: the proxy reads the cookie. A request waits for a
  // pending session write, so the one right after a login carries the new cookie.
  getAccessToken: async () => {
    await sessionWrite
    return undefined
  },
}

// This app owns the GraphQL transport. The propeller-v2-vue-ui package ships
// no client and no endpoint — we build the client here and hand it, plus the
// `services` bundle below, to <App> via providePropeller().
export const graphqlClient = new SessionGraphQLClient(clientConfig)

/**
 * A sibling client identified as the "order-editor" caller via the SDK's
 * built-in `clientId` (sent as the `X-Client-ID` header in proxy mode). The
 * proxy in `server.js` routes clientId-gated operations (`contactRegister`) to
 * the ORDER_EDITOR key only for this client id — so the authorization-settings
 * "add contact" uses the order key while public self-registration (the default
 * `graphqlClient`, no clientId) stays on the general key. No API key is sent
 * client-side; the proxy injects it server-side. Pass this to
 * `PurchaseAuthorizationConfigurator`'s `graphqlClient` prop.
 */
export const ORDER_EDITOR_CLIENT_ID = 'order-editor'
export const orderEditorGraphqlClient = new SessionGraphQLClient({
  ...clientConfig,
  clientId: ORDER_EDITOR_CLIENT_ID,
})

// The 15-service bundle keyed to our client, built by the package's factory.
// createServices is memoized per client, so this is the single shared bundle.
export const services = createServices(graphqlClient)

// Individual service exports — kept for the few view files that import them
// directly. New code should use `services` (or useServices() inside the
// provider tree) instead.
export const productService = new ProductService(graphqlClient)
export const categoryService = new CategoryService(graphqlClient)
export const cartService = new CartService(graphqlClient)
export const orderService = new OrderService(graphqlClient)
