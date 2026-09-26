import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Nach jedem Test den gerenderten Baum abraeumen, damit Tests einander nicht sehen.
afterEach(() => {
  cleanup()
})
