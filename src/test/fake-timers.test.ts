// Example of the fake-timers pattern that debounce tests (FR-2, Story 1.1) reuse.

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delayMs)
  }
}

describe('fake timers (debounce pattern)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires a debounced callback exactly once after the delay', () => {
    const callback = vi.fn()
    const debounced = debounce(callback, 300)

    debounced('a')
    debounced('ab')
    debounced('abc')

    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(299)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('abc')
  })
})
