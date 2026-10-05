import type { PlaceScores, ScoreWeights } from './types'

export const defaultScoreWeights: ScoreWeights = {
  taste: 40,
  environment: 20,
  service: 20,
  value: 20,
}

export function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= 10
}

export function createDefaultScores(): PlaceScores {
  return {
    environment: 8,
    service: 8,
    taste: 8,
    value: 8,
  }
}

export function calculateOverallScore(
  scores: PlaceScores,
  weights: ScoreWeights,
): number {
  const totalWeight =
    weights.taste + weights.environment + weights.service + weights.value

  if (totalWeight <= 0) {
    throw new Error('Score weights must be greater than 0.')
  }

  const weighted =
    scores.taste * weights.taste +
    scores.environment * weights.environment +
    scores.service * weights.service +
    scores.value * weights.value

  return Math.round((weighted / totalWeight) * 10) / 10
}

export function calculateAveragePrice(amounts: number[]): number | undefined {
  const validAmounts = amounts.filter((amount) => amount > 0)

  if (validAmounts.length === 0) {
    return undefined
  }

  const total = validAmounts.reduce((sum, amount) => sum + amount, 0)
  return Math.round(total / validAmounts.length)
}

export function normalizeAveragePrice(value: number | undefined): number | undefined {
  if (value === undefined || value <= 0) {
    return undefined
  }

  return value
}
