export const TIERS = {
    newcomer: 1,
    contributor: 10,
    trusted: 100,
    legend: 1000,
} as const

export type TierName = keyof typeof TIERS

export function isValidTier(tier: string): tier is TierName {
    return tier in TIERS
}

export function getTierThreshold(tier: TierName): number {
    return TIERS[tier]
}
