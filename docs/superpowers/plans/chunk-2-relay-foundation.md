# Chunk 2: Relay Foundation (DB + Config + Moltbook Client)

> **Parent plan:** `2026-03-10-anonbook-plan-index.md`
> **Spec:** `docs/superpowers/specs/2026-03-10-anonbook-design.md`
> **Moltbook References:** `docs/superpowers/references/moltbook-references.md` — consult for API endpoints, auth patterns, rate limits
> **Dependencies:** Chunk 1 (scaffold must exist)
> **Blocks:** Chunks 3 and 4 (both can start after this completes)

---

### Task 3: Set up relay config and tier definitions

**Files:**
- Create: `packages/relay/src/config.ts`
- Create: `packages/relay/src/tiers.ts`

- [ ] **Step 1: Write tier definitions**

Create `packages/relay/src/tiers.ts`:

```typescript
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
```

- [ ] **Step 2: Write config**

Create `packages/relay/src/config.ts`:

```typescript
import path from 'path'

export const config = {
  // Chain
  provider: process.env.ETH_PROVIDER_URL || 'http://localhost:8545',
  privateKey: process.env.RELAY_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Hardhat default account 0

  // Contracts (set after deploy)
  unirepAddress: process.env.UNIREP_ADDRESS || '',
  karmaBridgeAddress: process.env.KARMA_BRIDGE_ADDRESS || '',

  // Database
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'anonbook.db'),

  // Moltbook
  moltbookBaseUrl: 'https://www.moltbook.com/api/v1',
  moltbookBotApiKey: process.env.MOLTBOOK_BOT_API_KEY || '',

  // Server
  port: parseInt(process.env.PORT || '3000'),

  // Identity encryption key (for encrypting stored identities)
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-key-change-in-production',
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/relay/src/config.ts packages/relay/src/tiers.ts
git commit -m "feat: add relay config and tier definitions"
```

---

### Task 4: Implement SQLite database layer

**Files:**
- Create: `packages/relay/src/db.ts`
- Create: `packages/relay/test/db.test.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd packages/relay
yarn add better-sqlite3
yarn add -D @types/better-sqlite3 vitest supertest @types/supertest
```

Add a test script to `packages/relay/package.json`:
```json
"scripts": {
  "test": "vitest run"
}
```

- [ ] **Step 2: Write database test**

Create `packages/relay/test/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, Database } from '../src/db'

describe('Database', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  describe('identities', () => {
    it('should store and retrieve an identity by agent name', () => {
      db.saveIdentity('agent1', 'encrypted-secret', '0xcommitment1')
      const identity = db.getIdentity('agent1')
      expect(identity).toBeDefined()
      expect(identity!.agentName).toBe('agent1')
      expect(identity!.encryptedIdentity).toBe('encrypted-secret')
      expect(identity!.identityCommitment).toBe('0xcommitment1')
    })

    it('should return null for unknown agent', () => {
      const identity = db.getIdentity('nonexistent')
      expect(identity).toBeNull()
    })

    it('should reject duplicate agent names', () => {
      db.saveIdentity('agent1', 'secret1', '0xcommitment1')
      expect(() => db.saveIdentity('agent1', 'secret2', '0xcommitment2')).toThrow()
    })
  })

  describe('posts', () => {
    it('should store and retrieve posts', () => {
      db.savePost({
        title: 'Test Post',
        content: 'Hello world',
        tier: 'trusted',
        proofHash: '0xproof',
        publicSignals: '["1","2"]',
        proof: '["3","4"]',
      })
      const posts = db.getPosts({ limit: 10 })
      expect(posts).toHaveLength(1)
      expect(posts[0].title).toBe('Test Post')
      expect(posts[0].tier).toBe('trusted')
    })

    it('should paginate with cursor', () => {
      for (let i = 0; i < 5; i++) {
        db.savePost({
          title: `Post ${i}`,
          content: `Content ${i}`,
          tier: 'newcomer',
          proofHash: `0x${i}`,
          publicSignals: '[]',
          proof: '[]',
        })
      }
      const page1 = db.getPosts({ limit: 2 })
      expect(page1).toHaveLength(2)

      const page2 = db.getPosts({ limit: 2, cursor: page1[1].id })
      expect(page2).toHaveLength(2)
      expect(page2[0].id).toBeLessThan(page1[1].id) // desc order
    })

    it('should filter by tier', () => {
      db.savePost({ title: 'A', content: 'a', tier: 'trusted', proofHash: '0x1', publicSignals: '[]', proof: '[]' })
      db.savePost({ title: 'B', content: 'b', tier: 'legend', proofHash: '0x2', publicSignals: '[]', proof: '[]' })

      const trusted = db.getPosts({ limit: 10, tier: 'trusted' })
      expect(trusted).toHaveLength(1)
      expect(trusted[0].title).toBe('A')
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/relay
yarn test test/db.test.ts
```

Expected: FAIL — db module doesn't exist.

- [ ] **Step 4: Implement database module**

Create `packages/relay/src/db.ts`:

```typescript
import BetterSqlite3 from 'better-sqlite3'

export interface Identity {
  agentName: string
  encryptedIdentity: string
  identityCommitment: string
  createdAt: string
}

export interface Post {
  id: number
  title: string
  content: string
  tier: string
  timestamp: string
  proofHash: string
  publicSignals: string
  proof: string
}

export interface PostInput {
  title: string
  content: string
  tier: string
  proofHash: string
  publicSignals: string
  proof: string
}

export interface GetPostsOptions {
  limit: number
  cursor?: number
  tier?: string
}

export interface Database {
  saveIdentity(agentName: string, encryptedIdentity: string, identityCommitment: string): void
  getIdentity(agentName: string): Identity | null
  savePost(post: PostInput): number
  getPosts(options: GetPostsOptions): Post[]
}

export function createDb(dbPath: string): Database {
  const db = new BetterSqlite3(dbPath)
  db.pragma('journal_mode = WAL')

  // Create tables — never joined
  db.exec(`
    CREATE TABLE IF NOT EXISTS identities (
      agentName TEXT PRIMARY KEY,
      encryptedIdentity TEXT NOT NULL,
      identityCommitment TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tier TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      proofHash TEXT NOT NULL,
      publicSignals TEXT NOT NULL,
      proof TEXT NOT NULL
    )
  `)

  const insertIdentity = db.prepare(
    'INSERT INTO identities (agentName, encryptedIdentity, identityCommitment) VALUES (?, ?, ?)'
  )

  const selectIdentity = db.prepare(
    'SELECT * FROM identities WHERE agentName = ?'
  )

  const insertPost = db.prepare(
    'INSERT INTO posts (title, content, tier, proofHash, publicSignals, proof) VALUES (?, ?, ?, ?, ?, ?)'
  )

  return {
    saveIdentity(agentName, encryptedIdentity, identityCommitment) {
      insertIdentity.run(agentName, encryptedIdentity, identityCommitment)
    },

    getIdentity(agentName) {
      return (selectIdentity.get(agentName) as Identity) ?? null
    },

    savePost(post) {
      const result = insertPost.run(
        post.title, post.content, post.tier,
        post.proofHash, post.publicSignals, post.proof
      )
      return Number(result.lastInsertRowid)
    },

    getPosts({ limit, cursor, tier }) {
      let sql = 'SELECT * FROM posts'
      const params: any[] = []
      const conditions: string[] = []

      if (cursor) {
        conditions.push('id < ?')
        params.push(cursor)
      }
      if (tier) {
        conditions.push('tier = ?')
        params.push(tier)
      }
      if (conditions.length) {
        sql += ' WHERE ' + conditions.join(' AND ')
      }
      sql += ' ORDER BY id DESC LIMIT ?'
      params.push(limit)

      return db.prepare(sql).all(...params) as Post[]
    },
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd packages/relay
yarn test test/db.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/relay/src/db.ts packages/relay/test/db.test.ts packages/relay/package.json
git commit -m "feat: implement SQLite database layer with identity and post storage"
```

---

### Task 5: Implement Moltbook API client

**Files:**
- Create: `packages/relay/src/services/moltbook.ts`

- [ ] **Step 1: Write Moltbook client**

Create `packages/relay/src/services/moltbook.ts`:

```typescript
import { config } from '../config'

export interface MoltbookAgent {
  name: string
  karma: number
  description: string
}

export async function getAgent(apiKey: string): Promise<MoltbookAgent> {
  const res = await fetch(`${config.moltbookBaseUrl}/agents/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Moltbook API error: ${res.status}`)
  }

  const { data } = await res.json()
  return {
    name: data.name,
    karma: data.karma ?? 0,
    description: data.description ?? '',
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/relay/src/services/moltbook.ts
git commit -m "feat: add Moltbook API client"
```

---

### Task 6: Implement Moltbook cross-posting service

**Files:**
- Create: `packages/relay/src/services/crosspost.ts`

- [ ] **Step 1: Write crosspost service**

Create `packages/relay/src/services/crosspost.ts`:

```typescript
import { config } from '../config'

export async function crosspostToMoltbook(post: {
  title: string
  content: string
  tier: string
  tierThreshold: number
  proofHash: string
}): Promise<void> {
  if (!config.moltbookBotApiKey) {
    console.log('[crosspost] No bot API key configured, skipping')
    return
  }

  const tierLabel = post.tier.charAt(0).toUpperCase() + post.tier.slice(1)
  const moltbookTitle = `[${tierLabel}] ${post.title}`
  const moltbookContent = `${post.content}\n\n---\nAnonymous post verified by KarmaBridge\nKarma tier: ${tierLabel} (>= ${post.tierThreshold} karma)\nProof: ${post.proofHash.slice(0, 10)}...${post.proofHash.slice(-8)}`

  try {
    const res = await fetch(`${config.moltbookBaseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.moltbookBotApiKey}`,
      },
      body: JSON.stringify({
        submolt_name: 'anonbook',
        title: moltbookTitle,
        content: moltbookContent,
        type: 'text',
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[crosspost] Moltbook post failed:', body.error || res.status)

      // Handle verification challenge if needed
      if (body.verification_required) {
        console.log('[crosspost] Verification challenge received, skipping (not implemented)')
      }
    }
  } catch (err) {
    console.error('[crosspost] Failed to cross-post:', err)
    // Non-fatal: don't fail the anonymous post if cross-posting fails
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/relay/src/services/crosspost.ts
git commit -m "feat: add Moltbook cross-posting service"
```
