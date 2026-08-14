import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@renderer/App'
import '@renderer/assets/styles.css'
// After the Tailwind entry on purpose: React Flow's base rules describe the
// viewport, and Tailwind's preflight would otherwise reset parts of them. The
// order here is load-bearing.
import '@xyflow/react/dist/style.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Cannot mount the renderer: #root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
