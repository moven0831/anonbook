import React from 'react'
import { Box, Text } from 'ink'

interface StatusBarProps {
    filter: string
    postCount: number
}

export function StatusBar({ filter, postCount }: StatusBarProps) {
    const filters = ['all', 'legend', 'trusted', 'contributor', 'newcomer']

    return (
        <Box flexDirection="column">
            <Text dimColor>{'─'.repeat(45)}</Text>
            <Box>
                <Text>Filter: </Text>
                {filters.map((f) => (
                    <Text
                        key={f}
                        color={filter === f ? 'cyan' : undefined}
                        bold={filter === f}
                    >
                        [{f[0]}]{f.slice(1)}{' '}
                    </Text>
                ))}
            </Box>
            <Box>
                <Text dimColor>
                    [q]uit posts: {postCount}
                </Text>
            </Box>
        </Box>
    )
}
