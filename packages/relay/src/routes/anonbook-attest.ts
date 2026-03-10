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
import { ethers } from 'ethers'

export function attestRouter(db: Database): Router {
    const router = Router()

    router.post('/attest', async (req, res) => {
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

            // Get agent info from Moltbook
            const agent = await getAgent(moltbookApiKey)

            // Load stored identity
            const stored = db.getIdentity(agent.name)
            if (!stored) {
                return res.status(404).json({
                    success: false,
                    error: 'Agent not registered. Call /api/signup first.',
                })
            }

            // Decrypt and reconstruct identity
            const secret = decryptIdentity(
                stored.encryptedIdentity,
                config.encryptionKey
            )
            const identity = loadIdentity(secret)

            // Build UserState, auto-transition if needed, then generate proof
            const userState = await createUserState(identity)
            try {
                await ensureStateTransition(userState)
                const { publicSignals, proof } =
                    await userState.genEpochKeyProof({
                        nonce: 0,
                    })
                const epoch = await userState.latestTransitionedEpoch()

                // Submit attestation on-chain
                const provider = new ethers.providers.JsonRpcProvider(
                    config.provider
                )
                const wallet = new ethers.Wallet(config.privateKey, provider)
                const karmaBridge = new ethers.Contract(
                    config.karmaBridgeAddress,
                    [
                        'function attestKarma(uint256[] memory publicSignals, uint256[8] memory proof, uint256 karma) public',
                    ],
                    wallet
                )
                const tx = await karmaBridge.attestKarma(
                    publicSignals,
                    proof,
                    agent.karma
                )
                await tx.wait()

                res.json({
                    success: true,
                    epoch: Number(epoch),
                    karma: agent.karma,
                })
            } finally {
                userState.stop()
            }
        } catch (err: any) {
            console.error('[attest] Error:', err)
            res.status(500).json({ success: false, error: err.message })
        }
    })

    return router
}
