import { Router } from 'express'
import { Database } from '../db'
import { config } from '../config'
import { getAgent } from '../services/moltbook'
import {
    decryptIdentity,
    loadIdentity,
    createUserState,
    ensureStateTransition,
} from '../services/unirep'
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
                    error: 'Invalid tier. Must be one of: newcomer, contributor, trusted, legend',
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
            const secret = decryptIdentity(
                stored.encryptedIdentity,
                config.encryptionKey
            )
            const identity = loadIdentity(secret)
            const userState = await createUserState(identity)

            try {
                // Auto-transition if new epoch started
                await ensureStateTransition(userState)

                // Generate reputation proof: prove posRep >= tier threshold
                const threshold = getTierThreshold(tier as TierName)
                const { publicSignals, proof } =
                    await userState.genProveReputationProof({
                        minRep: threshold,
                    })

                // Compute proof hash for display
                const proofHash =
                    '0x' +
                    crypto
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
                }).catch((err) =>
                    console.error('[post] Crosspost error:', err)
                )

                res.json({ success: true, postId })
            } catch (proofErr: any) {
                const currentEpoch = await userState
                    .latestTransitionedEpoch()
                    .catch(() => 0)
                return res.status(400).json({
                    success: false,
                    error: 'attestation_stale',
                    message:
                        'Proof generation failed. Call /api/attest to refresh karma for current epoch, or verify your karma meets the tier threshold.',
                    epoch: Number(currentEpoch),
                })
            } finally {
                userState.stop()
            }
        } catch (err: any) {
            console.error('[post] Error:', err)
            res.status(500).json({ success: false, error: err.message })
        }
    })

    return router
}
