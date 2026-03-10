import { Router } from 'express'
import { Database } from '../db'
import { isValidTier } from '../tiers'

export function feedRouter(db: Database): Router {
    const router = Router()

    router.get('/posts', (req, res) => {
        const limit = Math.min(
            parseInt(req.query.limit as string) || 20,
            100
        )
        const cursor = req.query.cursor
            ? parseInt(req.query.cursor as string)
            : undefined
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
