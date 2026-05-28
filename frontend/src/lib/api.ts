import {
  GraphQLClient,
  ProductService,
  CategoryService,
  CartService,
  OrderService,
  type GraphQLClientConfig,
} from 'propeller-sdk-v2'
import { createServices } from 'propeller-v2-vue-ui'

// Use /api/graphql proxy in development (Vite proxy adds apikey server-side).
// The SDK still needs the key for its internal config, but the proxy handles headers.
const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT || '/api/graphql'

const clientConfig: GraphQLClientConfig = {
  endpoint,
  apiKey: import.meta.env.VITE_API_KEY || '',
  orderEditorApiKey: import.meta.env.VITE_ORDER_EDITOR_API_KEY || '',
  timeout: parseInt(import.meta.env.VITE_TIMEOUT || '30000', 10),
  headers: {},
}

// This app owns the GraphQL transport. The propeller-v2-vue-ui package ships
// no client and no endpoint — we build the client here and hand it, plus the
// `services` bundle below, to <App> via providePropeller().
export const graphqlClient = new GraphQLClient(clientConfig)

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
export const orderEditorGraphqlClient = new GraphQLClient({
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
