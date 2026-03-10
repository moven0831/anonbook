import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { signupRouter } from '../src/routes/anonbook-signup'
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

// Mock ethers contract call
vi.mock('ethers', () => ({
    ethers: {
        providers: {
            JsonRpcProvider: class {},
        },
        Wallet: class {},
        Contract: class {
            userSignUp = vi.fn().mockResolvedValue({
                wait: vi.fn().mockResolvedValue({}),
            })
        },
    },
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
        await request(app)
            .post('/api/signup')
            .send({ moltbookApiKey: 'test-key' })
        const res = await request(app)
            .post('/api/signup')
            .send({ moltbookApiKey: 'test-key' })

        expect(res.status).toBe(409)
        expect(res.body.error).toContain('already registered')
    })

    it('should reject missing API key', async () => {
        const res = await request(app).post('/api/signup').send({})

        expect(res.status).toBe(400)
    })
})
