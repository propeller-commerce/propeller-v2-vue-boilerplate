import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Proxy target — upstream GraphQL URL the Vite dev proxy forwards to.
  // VITE_GRAPHQL_PROXY_TARGET is server-only (used here, not exposed to the browser).
  // VITE_GRAPHQL_ENDPOINT is honored as a fallback for backwards compatibility.
  const graphqlEndpoint = env.VITE_GRAPHQL_PROXY_TARGET
    || env.VITE_GRAPHQL_ENDPOINT
    || 'https://api.staging.helice.cloud/v2/graphql'
  const apiKey = env.VITE_API_KEY || ''
  const behindProxy = env.VITE_BEHIND_PROXY === 'true'

  return {
    plugins: [
      vue(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      allowedHosts: [
        'vue-boilerplate.dev.wp-propel.com',
        'vue-boilerplate.prod.wp-propel.com',
      ],
      hmr: behindProxy ? { clientPort: 80 } : true,
      proxy: {
        '/api/graphql': {
          target: new URL(graphqlEndpoint).origin,
          changeOrigin: true,
          rewrite: () => new URL(graphqlEndpoint).pathname,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('apikey', apiKey)
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          },
        },
      },
    },
  }
})
