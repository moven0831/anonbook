# Chunk 4: Terminal UI

> **Parent plan:** `2026-03-10-anonbook-plan-index.md`
> **Spec:** `docs/superpowers/specs/2026-03-10-anonbook-design.md`
> **Dependencies:** Chunk 2 (scaffold with frontend package must exist)
> **Blocks:** Chunk 5
> **Parallel with:** Chunk 3 (Relay API routes) — no shared state. This chunk only depends on the `GET /api/posts` response format, not the implementation.

**API contract this chunk depends on (from spec):**
```
GET /api/posts?limit=20&cursor=<id>&tier=<tier>
Response: { success: boolean, posts: [{ id, title, content, tier, timestamp, proofHash, publicSignals, proof }] }
```

---

### Task 13: Set up Ink frontend package

**Files:**
- Modify: `packages/frontend/package.json`
- Create: `packages/frontend/src/index.tsx`
- Create: `packages/frontend/tsconfig.json`

- [ ] **Step 1: Replace scaffold frontend with Ink**

Remove scaffold React frontend contents and install Ink:

```bash
cd packages/frontend
rm -rf src/ public/ build/
yarn add ink ink-text-input react
yarn add -D @types/react typescript
```

- [ ] **Step 2: Create tsconfig**

Create `packages/frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create entry point**

Create `packages/frontend/src/index.tsx`:

```tsx
#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { App } from './App'

const relayUrl = process.argv[2] || 'http://localhost:3000'

render(<App relayUrl={relayUrl} />)
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/
git commit -m "feat: set up Ink-based terminal UI package"
```

---

### Task 14: Build TUI components

**Files:**
- Create: `packages/frontend/src/TierBadge.tsx`
- Create: `packages/frontend/src/PostCard.tsx`
- Create: `packages/frontend/src/StatusBar.tsx`
- Create: `packages/frontend/src/App.tsx`

- [ ] **Step 1: Create TierBadge component**

Create `packages/frontend/src/TierBadge.tsx`:

```tsx
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
  return <Text color={style.color} bold>{style.badge}</Text>
}
```

- [ ] **Step 2: Create PostCard component**

Create `packages/frontend/src/PostCard.tsx`:

```tsx
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
  const shortProof = post.proofHash.slice(0, 8) + '..' + post.proofHash.slice(-4)

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <TierBadge tier={post.tier} />
        <Text dimColor> · {timeAgo(post.timestamp)}</Text>
      </Box>
      <Text bold>{post.title}</Text>
      <Text>{post.content.length > 200 ? post.content.slice(0, 200) + '...' : post.content}</Text>
      <Text dimColor>proof: {shortProof}</Text>
      <Text dimColor>{'─'.repeat(45)}</Text>
    </Box>
  )
}
```

- [ ] **Step 3: Create StatusBar component**

Create `packages/frontend/src/StatusBar.tsx`:

```tsx
import React from 'react'
import { Box, Text } from 'ink'

interface StatusBarProps {
  filter: string
  postCount: number
}

export function StatusBar({ filter, postCount }: StatusBarProps) {
  const filters = ['all', 'legend', 'trusted', 'contributor', 'newcomer']

  return (
    <Box flexDirection="column" borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      <Box>
        <Text>Filter: </Text>
        {filters.map((f) => (
          <Text key={f} color={filter === f ? 'cyan' : undefined} bold={filter === f}>
            [{f[0]}]{f.slice(1)}{' '}
          </Text>
        ))}
      </Box>
      <Box>
        <Text dimColor>[q]uit    posts: {postCount}</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Create main App component**

Create `packages/frontend/src/App.tsx`:

```tsx
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
      case 'q': exit(); break
      case 'a': setFilter('all'); break
      case 'l': setFilter('legend'); break
      case 't': setFilter('trusted'); break
      case 'c': setFilter('contributor'); break
      case 'n': setFilter('newcomer'); break
    }
  })

  // Poll for posts
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const tierParam = filter !== 'all' ? `&tier=${filter}` : ''
        const res = await fetch(`${relayUrl}/api/posts?limit=20${tierParam}`)
        const data = await res.json()
        if (data.success) {
          setPosts(data.posts)
          setError(null)
        }
      } catch (err) {
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
        <Text bold color="cyan">anonbook</Text>
        <Text dimColor color="green">live</Text>
      </Box>

      {error && <Text color="red">{error}</Text>}

      {posts.length === 0 && !error && (
        <Text dimColor>No posts yet. Waiting for anonymous posts...</Text>
      )}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <StatusBar filter={filter} postCount={posts.length} />
    </Box>
  )
}
```

- [ ] **Step 5: Verify TUI renders**

```bash
cd packages/frontend
npx tsx src/index.tsx http://localhost:3000
```

Expected: Terminal UI renders with "No posts yet" message and status bar. Press `q` to quit.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/
git commit -m "feat: build Ink terminal UI with live feed, tier filtering, and keyboard controls"
```
