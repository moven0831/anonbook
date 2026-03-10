import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { feedRouter } from '../src/routes/anonbook-feed'
import { createDb } from '../src/db'

describe('GET /api/posts', () => {
    let app: express.Application
    let db: ReturnType<typeof createDb>

    beforeEach(() => {
        db = createDb(':memory:')
        app = express()
        app.use(express.json())
        app.use('/api', feedRouter(db))
    })

    it('should return empty array when no posts', async () => {
        const res = await request(app).get('/api/posts')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.posts).toHaveLength(0)
    })

    it('should return posts in descending order', async () => {
        db.savePost({
            title: 'First',
            content: 'first',
            tier: 'newcomer',
            proofHash: '0x1',
            publicSignals: '[]',
            proof: '[]',
        })
        db.savePost({
            title: 'Second',
            content: 'second',
            tier: 'trusted',
            proofHash: '0x2',
            publicSignals: '[]',
            proof: '[]',
        })

        const res = await request(app).get('/api/posts')

        expect(res.body.posts).toHaveLength(2)
        expect(res.body.posts[0].title).toBe('Second')
        expect(res.body.posts[1].title).toBe('First')
    })

    it('should support cursor pagination', async () => {
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

        const page1 = await request(app).get('/api/posts?limit=2')
        expect(page1.body.posts).toHaveLength(2)

        const cursor = page1.body.posts[1].id
        const page2 = await request(app).get(
            `/api/posts?limit=2&cursor=${cursor}`
        )
        expect(page2.body.posts).toHaveLength(2)
        expect(page2.body.posts[0].id).toBeLessThan(cursor)
    })

    it('should filter by tier', async () => {
        db.savePost({
            title: 'Trusted',
            content: 'a',
            tier: 'trusted',
            proofHash: '0x1',
            publicSignals: '[]',
            proof: '[]',
        })
        db.savePost({
            title: 'Legend',
            content: 'b',
            tier: 'legend',
            proofHash: '0x2',
            publicSignals: '[]',
            proof: '[]',
        })

        const res = await request(app).get('/api/posts?tier=trusted')

        expect(res.body.posts).toHaveLength(1)
        expect(res.body.posts[0].title).toBe('Trusted')
    })

    it('should reject invalid tier filter', async () => {
        const res = await request(app).get('/api/posts?tier=invalid')

        expect(res.status).toBe(400)
    })
})
