import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // .env lives one level up from frontend/
  const env = loadEnv(mode, resolve(__dirname, '..'), '')
  const graphqlEndpoint = env.VITE_GRAPHQL_ENDPOINT || 'https://api.helice.cloud/v2/graphql'
  const apiKey = env.VITE_API_KEY || ''
  const orderEditorApiKey = env.VITE_ORDER_EDITOR_API_KEY || ''

  const endpointUrl = new URL(graphqlEndpoint)
  const proxyTarget = endpointUrl.origin
  const proxyRewritePath = endpointUrl.pathname

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
      hmr: {
        clientPort: 80,
      },
      proxy: {
        '/api/graphql': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: () => proxyRewritePath,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('apikey', apiKey)
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          },
        },
        '/api/order-editor': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace('/api/order-editor', ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('apikey', orderEditorApiKey)
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          },
        },
      },
    },
  }
})
