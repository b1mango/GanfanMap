import { describe, expect, it } from 'vitest'
import { createRequestTracker } from './requestTracker'

describe('request tracker', () => {
  it('marks only the most recent request as current', () => {
    const tracker = createRequestTracker()
    const first = tracker.begin()
    const second = tracker.begin()

    expect(tracker.isCurrent(first)).toBe(false)
    expect(tracker.isCurrent(second)).toBe(true)
  })

  it('invalidates in-flight requests when the caller resets state', () => {
    const tracker = createRequestTracker()
    const pending = tracker.begin()

    tracker.invalidate()

    expect(tracker.isCurrent(pending)).toBe(false)
  })
})
