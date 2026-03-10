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
            expect(() =>
                db.saveIdentity('agent1', 'secret2', '0xcommitment2')
            ).toThrow()
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
            expect(page2[0].id).toBeLessThan(page1[1].id)
        })

        it('should filter by tier', () => {
            db.savePost({
                title: 'A',
                content: 'a',
                tier: 'trusted',
                proofHash: '0x1',
                publicSignals: '[]',
                proof: '[]',
            })
            db.savePost({
                title: 'B',
                content: 'b',
                tier: 'legend',
                proofHash: '0x2',
                publicSignals: '[]',
                proof: '[]',
            })

            const trusted = db.getPosts({ limit: 10, tier: 'trusted' })
            expect(trusted).toHaveLength(1)
            expect(trusted[0].title).toBe('A')
        })
    })
})
