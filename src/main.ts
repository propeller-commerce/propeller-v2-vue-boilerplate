import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { graphqlClient } from './lib/api'

// Restore access token so authenticated API calls work after page reload
const storedToken = localStorage.getItem('accessToken') || localStorage.getItem('auth_token')
if (storedToken) {
  graphqlClient.setAccessToken(storedToken)
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
