import React from 'react'
import { Box, Text } from 'ink'
import { TierBadge } from './TierBadge'

interface Post {
    id: number
    title: string
    content: string
    tier: string
    timestamp: string
    proofHash: string
}

function timeAgo(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

export function PostCard({ post }: { post: Post }) {
    const shortProof =
        post.proofHash.slice(0, 8) + '..' + post.proofHash.slice(-4)

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box>
                <TierBadge tier={post.tier} />
                <Text dimColor> · {timeAgo(post.timestamp)}</Text>
            </Box>
            <Text bold>{post.title}</Text>
            <Text>
                {post.content.length > 200
                    ? post.content.slice(0, 200) + '...'
                    : post.content}
            </Text>
            <Text dimColor>proof: {shortProof}</Text>
            <Text dimColor>{'─'.repeat(45)}</Text>
        </Box>
    )
}
