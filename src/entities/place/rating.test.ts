import { describe, expect, it } from 'vitest'
import {
  calculateAveragePrice,
  calculateOverallScore,
  isValidScore,
} from './rating'

describe('rating rules', () => {
  it('calculates weighted overall score to one decimal place', () => {
    expect(
      calculateOverallScore(
        { taste: 9, environment: 8, service: 7, value: 6 },
        { taste: 40, environment: 20, service: 20, value: 20 },
      ),
    ).toBe(7.8)
  })

  it('rejects scores outside the 1-10 range', () => {
    expect(isValidScore(0)).toBe(false)
    expect(isValidScore(10)).toBe(true)
    expect(isValidScore(10.5)).toBe(false)
  })

  it('calculates average price from visit amounts', () => {
    expect(calculateAveragePrice([128, 92, 80])).toBe(100)
    expect(calculateAveragePrice([])).toBeUndefined()
  })
})

