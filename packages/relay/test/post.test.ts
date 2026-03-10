import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { postRouter } from '../src/routes/anonbook-post'
import { createDb } from '../src/db'

// Mock Moltbook API
vi.mock('../src/services/moltbook', () => ({
    getAgent: vi.fn().mockResolvedValue({
        name: 'TestAgent',
        karma: 50,
        description: 'A test agent',
    }),
}))

// Mock UniRep service
vi.mock('../src/services/unirep', () => ({
    decryptIdentity: vi.fn().mockReturnValue('mock-secret'),
    loadIdentity: vi.fn().mockReturnValue({}),
    createUserState: vi.fn().mockResolvedValue({
        genProveReputationProof: vi.fn().mockResolvedValue({
            publicSignals: ['1', '2', '3'],
            proof: ['4', '5', '6', '7', '8', '9', '10', '11'],
        }),
        latestTransitionedEpoch: vi.fn().mockResolvedValue(0n),
        stop: vi.fn(),
    }),
    ensureStateTransition: vi.fn().mockResolvedValue(undefined),
}))

// Mock crosspost (fire and forget)
vi.mock('../src/services/crosspost', () => ({
    crosspostToMoltbook: vi.fn().mockResolvedValue(undefined),
}))

describe('POST /api/post', () => {
    let app: express.Application
    let db: ReturnType<typeof createDb>

    beforeEach(() => {
        db = createDb(':memory:')
        app = express()
        app.use(express.json())
        app.use('/api', postRouter(db))
        // Pre-register agent
        db.saveIdentity('TestAgent', 'encrypted-secret', '0xcommitment')
    })

    it('should create an anonymous post', async () => {
        const res = await request(app).post('/api/post').send({
            moltbookApiKey: 'test-key',
            title: 'Hello anon world',
            content: 'Test post content',
            tier: 'newcomer',
        })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.postId).toBe(1)

        // Verify post stored without agent name
        const posts = db.getPosts({ limit: 10 })
        expect(posts).toHaveLength(1)
        expect(posts[0].title).toBe('Hello anon world')
    })

    it('should reject invalid tier', async () => {
        const res = await request(app).post('/api/post').send({
            moltbookApiKey: 'test-key',
            title: 'Test',
            content: 'Test',
            tier: 'invalid',
        })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('Invalid tier')
    })

    it('should return 404 for unregistered agent', async () => {
        // Create fresh DB without pre-registered agent
        const freshDb = createDb(':memory:')
        const freshApp = express()
        freshApp.use(express.json())
        freshApp.use('/api', postRouter(freshDb))

        const res = await request(freshApp).post('/api/post').send({
            moltbookApiKey: 'test-key',
            title: 'Test',
            content: 'Test',
            tier: 'newcomer',
        })

        expect(res.status).toBe(404)
    })

    it('should reject missing required fields', async () => {
        const res = await request(app).post('/api/post').send({
            moltbookApiKey: 'test-key',
        })

        expect(res.status).toBe(400)
    })
})
