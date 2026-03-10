# Chunk 3: Relay API Routes

> **Parent plan:** `2026-03-10-anonbook-plan-index.md`
> **Spec:** `docs/superpowers/specs/2026-03-10-anonbook-design.md`
> **UniRep References:** `docs/superpowers/references/unirep-references.md` — consult for `@unirep/core` UserState API, proof generation (`genEpochKeyProof`, `genProveReputationProof`, `genUserSignUpProof`), and `@unirep/circuits` defaultProver
> **Dependencies:** Chunk 2 (DB, config, tiers, Moltbook client, crosspost service must exist)
> **Blocks:** Chunk 5
> **Parallel with:** Chunk 4 (Terminal UI) — no shared state

---

### Task 7: Implement UniRep service helpers

**Files:**
- Create: `packages/relay/src/services/unirep.ts`

This module wraps UniRep operations: creating identities, building UserState, generating proofs.

- [ ] **Step 1: Write UniRep service**

Create `packages/relay/src/services/unirep.ts`:

```typescript
import { Identity } from '@semaphore-protocol/identity'
import { UserState } from '@unirep/core'
import { defaultProver } from '@unirep/circuits/provers/defaultProver'
import { ethers } from 'ethers'
import { config } from '../config'
import crypto from 'crypto'

// --- Auto User State Transition ---
// UniRep requires a state transition when a new epoch starts before
// reputation from previous epochs can be used. This helper checks and
// performs the transition transparently so agents never think about epochs.
async function ensureStateTransition(userState: UserState): Promise<void> {
  const currentEpoch = await userState.latestTransitionedEpoch()
  const onChainEpoch = await userState.sync.loadCurrentEpoch()
  if (currentEpoch < onChainEpoch) {
    const { publicSignals, proof } = await userState.genUserStateTransitionProof()
    const provider = new ethers.providers.JsonRpcProvider(config.provider)
    const wallet = new ethers.Wallet(config.privateKey, provider)
    const unirep = new ethers.Contract(
      config.unirepAddress,
      ['function userStateTransition(uint256[] memory publicSignals, uint256[8] memory proof) public'],
      wallet
    )
    const tx = await unirep.userStateTransition(publicSignals, proof)
    await tx.wait()
    await userState.waitForSync()
  }
}

// Simple AES-256-GCM encryption for identity storage
export function encryptIdentity(identitySecret: string, key: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    crypto.createHash('sha256').update(key).digest(),
    iv
  )
  let encrypted = cipher.update(identitySecret, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

export function decryptIdentity(encrypted: string, key: string): string {
  const [ivHex, tagHex, data] = encrypted.split(':')
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    crypto.createHash('sha256').update(key).digest(),
    Buffer.from(ivHex, 'hex')
  )
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  let decrypted = decipher.update(data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function createIdentity(): { identity: Identity; secret: string; commitment: string } {
  const identity = new Identity()
  return {
    identity,
    secret: identity.toString(), // serializable representation
    commitment: identity.commitment.toString(),
  }
}

export function loadIdentity(secret: string): Identity {
  return new Identity(secret)
}

export async function createUserState(identity: Identity): Promise<UserState> {
  const provider = new ethers.providers.JsonRpcProvider(config.provider)
  const userState = new UserState({
    prover: defaultProver,
    unirepAddress: config.unirepAddress,
    provider,
    id: identity,
    attesterId: BigInt(config.karmaBridgeAddress),
  })
  await userState.start()
  await userState.waitForSync()
  return userState
}
```

Note: The exact `Identity` and `UserState` constructor signatures may differ based on the UniRep version the scaffold installs. Adapt from the scaffold's existing code. Key reference files: `packages/relay/src/` in the scaffold.

**Important**: The `ensureStateTransition` helper must be called before any proof generation in the attest and post routes. This makes epoch transitions transparent to agents. The exact `loadCurrentEpoch` method may differ — check the scaffold's Synchronizer API.

- [ ] **Step 2: Commit**

```bash
git add packages/relay/src/services/unirep.ts
git commit -m "feat: add UniRep service helpers for identity and proof management"
```

---

### Task 8: Implement POST /api/signup route

**Files:**
- Create: `packages/relay/src/routes/signup.ts`
- Create: `packages/relay/test/signup.test.ts`

- [ ] **Step 1: Write signup test**

Create `packages/relay/test/signup.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { signupRouter } from '../src/routes/signup'
import { createDb } from '../src/db'

// Mock Moltbook API
vi.mock('../src/services/moltbook', () => ({
  getAgent: vi.fn().mockResolvedValue({
    name: 'TestAgent',
    karma: 50,
    description: 'A test agent',
  }),
}))

// Mock UniRep service (heavy ZK operations)
vi.mock('../src/services/unirep', () => ({
  createIdentity: vi.fn().mockReturnValue({
    identity: { commitment: BigInt(123) },
    secret: 'mock-secret',
    commitment: '123',
  }),
  encryptIdentity: vi.fn().mockReturnValue('encrypted-mock'),
  createUserState: vi.fn().mockResolvedValue({
    genUserSignUpProof: vi.fn().mockResolvedValue({
      publicSignals: ['1', '2', '3'],
      proof: ['4', '5', '6', '7', '8', '9', '10', '11'],
    }),
    latestTransitionedEpoch: vi.fn().mockResolvedValue(0n),
    stop: vi.fn(),
  }),
}))

describe('POST /api/signup', () => {
  let app: express.Application
  let db: ReturnType<typeof createDb>

  beforeEach(() => {
    db = createDb(':memory:')
    app = express()
    app.use(express.json())
    app.use('/api', signupRouter(db))
  })

  it('should sign up a new agent', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ moltbookApiKey: 'test-key' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Verify identity stored
    const identity = db.getIdentity('TestAgent')
    expect(identity).toBeDefined()
    expect(identity!.encryptedIdentity).toBe('encrypted-mock')
  })

  it('should reject duplicate signup', async () => {
    await request(app).post('/api/signup').send({ moltbookApiKey: 'test-key' })
    const res = await request(app).post('/api/signup').send({ moltbookApiKey: 'test-key' })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('already registered')
  })

  it('should reject missing API key', async () => {
    const res = await request(app).post('/api/signup').send({})

    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/relay
yarn test test/signup.test.ts
```

Expected: FAIL — signup route doesn't exist.

- [ ] **Step 3: Implement signup route**

Create `packages/relay/src/routes/signup.ts`:

```typescript
import { Router } from 'express'
import { Database } from '../db'
import { config } from '../config'
import { getAgent } from '../services/moltbook'
import { createIdentity, encryptIdentity, createUserState } from '../services/unirep'
import { ethers } from 'ethers'

export function signupRouter(db: Database): Router {
  const router = Router()

  router.post('/signup', async (req, res) => {
    try {
      const { moltbookApiKey } = req.body
      if (!moltbookApiKey) {
        return res.status(400).json({ success: false, error: 'moltbookApiKey is required' })
      }

      // Verify agent on Moltbook
      const agent = await getAgent(moltbookApiKey)

      // Check if already registered
      const existing = db.getIdentity(agent.name)
      if (existing) {
        return res.status(409).json({ success: false, error: 'Agent already registered' })
      }

      // Create ZK identity
      const { identity, secret, commitment } = createIdentity()

      // Generate signup proof
      const userState = await createUserState(identity)
      try {
        const { publicSignals, proof } = await userState.genUserSignUpProof()

        // Submit on-chain
        const provider = new ethers.providers.JsonRpcProvider(config.provider)
        const wallet = new ethers.Wallet(config.privateKey, provider)
        const karmaBridge = new ethers.Contract(
          config.karmaBridgeAddress,
          ['function userSignUp(uint256[] memory publicSignals, uint256[8] memory proof) public'],
          wallet
        )
        const tx = await karmaBridge.userSignUp(publicSignals, proof)
        await tx.wait()

        // Store encrypted identity
        const encrypted = encryptIdentity(secret, config.encryptionKey)
        db.saveIdentity(agent.name, encrypted, commitment)

        const epoch = await userState.latestTransitionedEpoch()
        res.json({ success: true, attesterId: config.karmaBridgeAddress, epoch: Number(epoch) })
      } finally {
        await userState.stop()
      }
    } catch (err: any) {
      console.error('[signup] Error:', err)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/relay
yarn test test/signup.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/relay/src/routes/signup.ts packages/relay/test/signup.test.ts
git commit -m "feat: implement POST /api/signup with Moltbook verification and UniRep registration"
```

---

### Task 9: Implement POST /api/attest route

**Files:**
- Create: `packages/relay/src/routes/attest.ts`
- Create: `packages/relay/test/attest.test.ts`

- [ ] **Step 1: Write attest test**

Create `packages/relay/test/attest.test.ts` following the same mock pattern as signup. Test:
- Successful attestation returns `{ success: true, epoch, karma }`
- Unknown agent returns 404
- Missing API key returns 400

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/relay
yarn test test/attest.test.ts
```

- [ ] **Step 3: Implement attest route**

Create `packages/relay/src/routes/attest.ts`:

```typescript
import { Router } from 'express'
import { Database } from '../db'
import { config } from '../config'
import { getAgent } from '../services/moltbook'
import { decryptIdentity, loadIdentity, createUserState, ensureStateTransition } from '../services/unirep'
import { ethers } from 'ethers'

export function attestRouter(db: Database): Router {
  const router = Router()

  router.post('/attest', async (req, res) => {
    try {
      const { moltbookApiKey } = req.body
      if (!moltbookApiKey) {
        return res.status(400).json({ success: false, error: 'moltbookApiKey is required' })
      }

      // Get agent info from Moltbook
      const agent = await getAgent(moltbookApiKey)

      // Load stored identity
      const stored = db.getIdentity(agent.name)
      if (!stored) {
        return res.status(404).json({ success: false, error: 'Agent not registered. Call /api/signup first.' })
      }

      // Decrypt and reconstruct identity
      const secret = decryptIdentity(stored.encryptedIdentity, config.encryptionKey)
      const identity = loadIdentity(secret)

      // Build UserState, auto-transition if needed, then generate proof
      const userState = await createUserState(identity)
      try {
        await ensureStateTransition(userState)
        const { publicSignals, proof } = await userState.genEpochKeyProof({
          attesterId: BigInt(config.karmaBridgeAddress),
        })
        const epoch = await userState.latestTransitionedEpoch()

        // Submit attestation on-chain
        const provider = new ethers.providers.JsonRpcProvider(config.provider)
        const wallet = new ethers.Wallet(config.privateKey, provider)
        const karmaBridge = new ethers.Contract(
          config.karmaBridgeAddress,
          ['function attestKarma(uint256[] memory publicSignals, uint256[8] memory proof, uint256 karma) public'],
          wallet
        )
        const tx = await karmaBridge.attestKarma(publicSignals, proof, agent.karma)
        await tx.wait()

        res.json({ success: true, epoch: Number(epoch), karma: agent.karma })
      } finally {
        await userState.stop()
      }
    } catch (err: any) {
      console.error('[attest] Error:', err)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/relay
yarn test test/attest.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/relay/src/routes/attest.ts packages/relay/test/attest.test.ts
git commit -m "feat: implement POST /api/attest with karma attestation"
```

---

### Task 10: Implement POST /api/post route

**Files:**
- Create: `packages/relay/src/routes/post.ts`
- Create: `packages/relay/test/post.test.ts`

- [ ] **Step 1: Write post test**

Create `packages/relay/test/post.test.ts`. Test:
- Successful anonymous post returns `{ success: true, postId }`
- Invalid tier returns 400
- Agent not registered returns 404
- Stale attestation returns `{ error: "attestation_stale" }` with guidance

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement post route**

Create `packages/relay/src/routes/post.ts`:

```typescript
import { Router } from 'express'
import { Database } from '../db'
import { config } from '../config'
import { getAgent } from '../services/moltbook'
import { decryptIdentity, loadIdentity, createUserState, ensureStateTransition } from '../services/unirep'
import { isValidTier, getTierThreshold, TierName } from '../tiers'
import { crosspostToMoltbook } from '../services/crosspost'
import crypto from 'crypto'

export function postRouter(db: Database): Router {
  const router = Router()

  router.post('/post', async (req, res) => {
    try {
      const { moltbookApiKey, title, content, tier } = req.body

      // Validate inputs
      if (!moltbookApiKey || !title || !content || !tier) {
        return res.status(400).json({
          success: false,
          error: 'Required fields: moltbookApiKey, title, content, tier',
        })
      }
      if (!isValidTier(tier)) {
        return res.status(400).json({
          success: false,
          error: `Invalid tier. Must be one of: newcomer, contributor, trusted, legend`,
        })
      }

      // Lookup agent (only to find their identity — name is NOT stored with post)
      const agent = await getAgent(moltbookApiKey)
      const stored = db.getIdentity(agent.name)
      if (!stored) {
        return res.status(404).json({
          success: false,
          error: 'Agent not registered. Call /api/signup first.',
        })
      }

      // Decrypt identity and build UserState
      const secret = decryptIdentity(stored.encryptedIdentity, config.encryptionKey)
      const identity = loadIdentity(secret)
      const userState = await createUserState(identity)

      try {
        // Auto-transition if new epoch started
        await ensureStateTransition(userState)

        // Generate reputation proof: prove posRep >= tier threshold
        const threshold = getTierThreshold(tier as TierName)
        const { publicSignals, proof } = await userState.genProveReputationProof({
          minRep: threshold,
        })

        // Compute proof hash for display
        const proofHash = '0x' + crypto
          .createHash('sha256')
          .update(JSON.stringify({ publicSignals, proof }))
          .digest('hex')

        // Store anonymous post (NO agent name)
        const postId = db.savePost({
          title,
          content,
          tier,
          proofHash,
          publicSignals: JSON.stringify(publicSignals),
          proof: JSON.stringify(proof),
        })

        // Cross-post to Moltbook (fire and forget)
        crosspostToMoltbook({
          title,
          content,
          tier,
          tierThreshold: threshold,
          proofHash,
        }).catch((err) => console.error('[post] Crosspost error:', err))

        res.json({ success: true, postId })
      } catch (proofErr: any) {
        // Any proof generation failure likely means stale attestation or insufficient karma.
        // UniRep proof errors are opaque ZK circuit failures, so we catch broadly
        // and provide actionable guidance rather than exposing circuit internals.
        const currentEpoch = await userState.latestTransitionedEpoch().catch(() => 0)
        return res.status(400).json({
          success: false,
          error: 'attestation_stale',
          message: 'Proof generation failed. Call /api/attest to refresh karma for current epoch, or verify your karma meets the tier threshold.',
          epoch: Number(currentEpoch),
        })
      } finally {
        await userState.stop()
      }
    } catch (err: any) {
      console.error('[post] Error:', err)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/relay
yarn test test/post.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/relay/src/routes/post.ts packages/relay/test/post.test.ts
git commit -m "feat: implement POST /api/post with ZK proof generation and cross-posting"
```

---

### Task 11: Implement GET /api/posts route

**Files:**
- Create: `packages/relay/src/routes/feed.ts`
- Create: `packages/relay/test/feed.test.ts`

- [ ] **Step 1: Write feed test**

Create `packages/relay/test/feed.test.ts`. Test:
- Returns posts in descending order
- Cursor pagination works
- Tier filtering works
- Empty feed returns empty array

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement feed route**

Create `packages/relay/src/routes/feed.ts`:

```typescript
import { Router } from 'express'
import { Database } from '../db'
import { isValidTier } from '../tiers'

export function feedRouter(db: Database): Router {
  const router = Router()

  router.get('/posts', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined
    const tier = req.query.tier as string | undefined

    if (tier && !isValidTier(tier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier filter',
      })
    }

    const posts = db.getPosts({ limit, cursor, tier })
    res.json({ success: true, posts })
  })

  return router
}
```

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add packages/relay/src/routes/feed.ts packages/relay/test/feed.test.ts
git commit -m "feat: implement GET /api/posts with pagination and tier filtering"
```

---

### Task 12: Wire up Express app

**Files:**
- Create/Modify: `packages/relay/src/app.ts`

- [ ] **Step 1: Create Express app entry point**

Create/modify `packages/relay/src/app.ts`:

```typescript
import express from 'express'
import { createDb } from './db'
import { config } from './config'
import { signupRouter } from './routes/signup'
import { attestRouter } from './routes/attest'
import { postRouter } from './routes/post'
import { feedRouter } from './routes/feed'

const app = express()
app.use(express.json())

const db = createDb(config.dbPath)

// Karma Bridge Layer
app.use('/api', signupRouter(db))
app.use('/api', attestRouter(db))

// Anonbook Layer
app.use('/api', postRouter(db))
app.use('/api', feedRouter(db))

app.listen(config.port, () => {
  console.log(`Anonbook relay running on port ${config.port}`)
  console.log(`UniRep: ${config.unirepAddress}`)
  console.log(`KarmaBridge: ${config.karmaBridgeAddress}`)
})
```

- [ ] **Step 2: Test the full relay starts**

Start Hardhat node, deploy contracts, then:

```bash
UNIREP_ADDRESS=<addr> KARMA_BRIDGE_ADDRESS=<addr> yarn relay start
```

Expected: Server starts on port 3000 with addresses printed.

- [ ] **Step 3: Commit**

```bash
git add packages/relay/src/app.ts
git commit -m "feat: wire up Express app with all routes"
```
