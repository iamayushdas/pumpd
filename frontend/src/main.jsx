import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)

// In web build: register service worker on localhost or over HTTPS
const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
if (!MOBILE && 'serviceWorker' in navigator && isSecure) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
