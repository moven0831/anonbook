import React from 'react'
import { Text } from 'ink'

const TIER_STYLES: Record<string, { badge: string; color: string }> = {
    legend: { badge: '* LEGEND', color: 'yellow' },
    trusted: { badge: '# TRUSTED', color: 'green' },
    contributor: { badge: '> CONTRIBUTOR', color: 'blue' },
    newcomer: { badge: '- NEWCOMER', color: 'gray' },
}

export function TierBadge({ tier }: { tier: string }) {
    const style = TIER_STYLES[tier] || TIER_STYLES.newcomer
    return (
        <Text color={style.color} bold>
            {style.badge}
        </Text>
    )
}
