import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@renderer/App'
import '@renderer/assets/styles.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Cannot mount the renderer: #root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
