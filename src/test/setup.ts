import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { mockServer } from './mocks/server'

// `error` statt `warn`: Eine nicht abgedeckte Anfrage ist eine Luecke im Test
// und keine Nebensaechlichkeit – sie faellt sonst erst im Betrieb auf.
beforeAll(() => mockServer.listen({ onUnhandledRequest: 'error' }))

// Nach jedem Test den gerenderten Baum abraeumen und die Handler zuruecksetzen,
// damit Tests einander nicht sehen.
afterEach(() => {
  cleanup()
  mockServer.resetHandlers()
})

afterAll(() => mockServer.close())
