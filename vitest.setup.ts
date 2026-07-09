import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './src/test/msw/server'

// All HTTP in unit/integration tests is mocked at the network boundary by MSW.
// Any request without a handler fails the test — fetch stubs are forbidden.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
