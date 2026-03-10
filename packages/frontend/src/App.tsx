import React, { useState, useEffect } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { PostCard } from './PostCard'
import { StatusBar } from './StatusBar'

interface Post {
    id: number
    title: string
    content: string
    tier: string
    timestamp: string
    proofHash: string
}

export function App({ relayUrl }: { relayUrl: string }) {
    const { exit } = useApp()
    const [posts, setPosts] = useState<Post[]>([])
    const [filter, setFilter] = useState('all')
    const [error, setError] = useState<string | null>(null)

    // Keyboard controls
    useInput((input) => {
        switch (input) {
            case 'q':
                exit()
                break
            case 'a':
                setFilter('all')
                break
            case 'l':
                setFilter('legend')
                break
            case 't':
                setFilter('trusted')
                break
            case 'c':
                setFilter('contributor')
                break
            case 'n':
                setFilter('newcomer')
                break
        }
    })

    // Poll for posts
    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const tierParam = filter !== 'all' ? `&tier=${filter}` : ''
                const res = await fetch(
                    `${relayUrl}/api/posts?limit=20${tierParam}`
                )
                const data = await res.json()
                if (data.success) {
                    setPosts(data.posts)
                    setError(null)
                }
            } catch {
                setError(`Cannot reach relay at ${relayUrl}`)
            }
        }

        fetchPosts()
        const interval = setInterval(fetchPosts, 3000)
        return () => clearInterval(interval)
    }, [relayUrl, filter])

    return (
        <Box flexDirection="column">
            <Box justifyContent="space-between" marginBottom={1}>
                <Text bold color="cyan">
                    anonbook
                </Text>
                <Text dimColor color="green">
                    live
                </Text>
            </Box>

            {error && <Text color="red">{error}</Text>}

            {posts.length === 0 && !error && (
                <Text dimColor>
                    No posts yet. Waiting for anonymous posts...
                </Text>
            )}

            {posts.map((post) => (
                <PostCard key={post.id} post={post} />
            ))}

            <StatusBar filter={filter} postCount={posts.length} />
        </Box>
    )
}
