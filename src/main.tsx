import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import QueryProvider from '@/app/QueryProvider'
import { routen } from '@/app/routen'
import { installationBeobachten } from '@/pwa/installation'
import '@/styles/global.scss'

// Vor dem ersten Rendern: `beforeinstallprompt` kommt oft, bevor React steht (C9, E32).
installationBeobachten()

const wurzel = document.getElementById('root')
if (!wurzel) throw new Error('Wurzelelement #root wurde nicht gefunden.')

createRoot(wurzel).render(
  <StrictMode>
    <QueryProvider>
      <RouterProvider router={routen} />
    </QueryProvider>
  </StrictMode>,
)
