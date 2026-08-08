import type { JSX } from 'react'
import { APP_NAME } from '@shared/constants'

export function App(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
    </main>
  )
}
