import {
  GraphQLClient,
  ProductService,
  CategoryService,
  CartService,
  OrderService,
  type GraphQLClientConfig,
} from 'propeller-sdk-v2'

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

export const graphqlClient = new GraphQLClient(clientConfig)
export const productService = new ProductService(graphqlClient)
export const categoryService = new CategoryService(graphqlClient)
export const cartService = new CartService(graphqlClient)
export const orderService = new OrderService(graphqlClient)
