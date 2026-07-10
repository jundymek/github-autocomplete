import { render, screen } from '@testing-library/react'

import App from './App'

/**
 * Smoke test for the demo page (Story 3.1). Asserts the page composes the
 * header thesis, the contract strip, and both instances. The country instance's
 * end-to-end behavior lives in `src/demo/countryInstance.test.tsx`; the GitHub
 * instance in Story 2.3's tests — here we only prove the demo mounts both panels
 * with distinct, accessible comboboxes.
 */
describe('App (demo page)', () => {
  it('renders the headline thesis and the contract strip', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: /one autocomplete, any data/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('min 3 characters')).toBeInTheDocument()
    expect(screen.getByText('sorted A→Z by name')).toBeInTheDocument()
  })

  it('mounts both instances via their accessible section headings', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'GitHub users & repositories' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Country picker' })).toBeInTheDocument()
  })

  it('exposes both comboboxes with distinct accessible names', () => {
    render(<App />)

    expect(screen.getByRole('combobox', { name: 'Search GitHub' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Search countries' })).toBeInTheDocument()
  })
})
