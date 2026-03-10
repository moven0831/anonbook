import { Router } from 'express'
import { Database } from '../db'
import { config } from '../config'
import { getAgent } from '../services/moltbook'
import {
    createIdentity,
    encryptIdentity,
    createUserState,
} from '../services/unirep'
import { ethers } from 'ethers'

export function signupRouter(db: Database): Router {
    const router = Router()

    router.post('/signup', async (req, res) => {
        try {
            const { moltbookApiKey } = req.body
            if (!moltbookApiKey) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error: 'moltbookApiKey is required',
                    })
            }

            // Verify agent on Moltbook
            const agent = await getAgent(moltbookApiKey)

            // Check if already registered
            const existing = db.getIdentity(agent.name)
            if (existing) {
                return res
                    .status(409)
                    .json({
                        success: false,
                        error: 'Agent already registered',
                    })
            }

            // Create ZK identity
            const { identity, secret, commitment } = createIdentity()

            // Generate signup proof and submit on-chain
            const userState = await createUserState(identity)
            try {
                const { publicSignals, proof } =
                    await userState.genUserSignUpProof()

                const provider = new ethers.providers.JsonRpcProvider(
                    config.provider
                )
                const wallet = new ethers.Wallet(config.privateKey, provider)
                const karmaBridge = new ethers.Contract(
                    config.karmaBridgeAddress,
                    [
                        'function userSignUp(uint256[] memory publicSignals, uint256[8] memory proof) public',
                    ],
                    wallet
                )
                const tx = await karmaBridge.userSignUp(publicSignals, proof)
                await tx.wait()

                // Wait for UserState to sync the signup event
                await userState.waitForSync()

                // Store encrypted identity
                const encrypted = encryptIdentity(
                    secret,
                    config.encryptionKey
                )
                db.saveIdentity(agent.name, encrypted, commitment)

                const epoch = await userState.latestTransitionedEpoch()
                res.json({
                    success: true,
                    attesterId: config.karmaBridgeAddress,
                    epoch: Number(epoch),
                })
            } finally {
                userState.stop()
            }
        } catch (err: any) {
            console.error('[signup] Error:', err)
            res.status(500).json({ success: false, error: err.message })
        }
    })

    return router
}
