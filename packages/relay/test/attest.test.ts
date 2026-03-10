import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { attestRouter } from '../src/routes/anonbook-attest'
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
        genEpochKeyProof: vi.fn().mockResolvedValue({
            publicSignals: ['1', '2', '3'],
            proof: ['4', '5', '6', '7', '8', '9', '10', '11'],
        }),
        latestTransitionedEpoch: vi.fn().mockResolvedValue(0n),
        stop: vi.fn(),
    }),
    ensureStateTransition: vi.fn().mockResolvedValue(undefined),
}))

// Mock ethers
vi.mock('ethers', () => ({
    ethers: {
        providers: {
            JsonRpcProvider: class {},
        },
        Wallet: class {},
        Contract: class {
            attestKarma = vi.fn().mockResolvedValue({
                wait: vi.fn().mockResolvedValue({}),
            })
        },
    },
}))

describe('POST /api/attest', () => {
    let app: express.Application
    let db: ReturnType<typeof createDb>

    beforeEach(() => {
        db = createDb(':memory:')
        app = express()
        app.use(express.json())
        app.use('/api', attestRouter(db))
    })

    it('should attest karma for registered agent', async () => {
        // Pre-register agent
        db.saveIdentity('TestAgent', 'encrypted-secret', '0xcommitment')

        const res = await request(app)
            .post('/api/attest')
            .send({ moltbookApiKey: 'test-key' })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.karma).toBe(50)
    })

    it('should return 404 for unregistered agent', async () => {
        const res = await request(app)
            .post('/api/attest')
            .send({ moltbookApiKey: 'test-key' })

        expect(res.status).toBe(404)
        expect(res.body.error).toContain('not registered')
    })

    it('should reject missing API key', async () => {
        const res = await request(app).post('/api/attest').send({})

        expect(res.status).toBe(400)
    })
})
