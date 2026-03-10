import { Router } from 'express'
import { ethers } from 'ethers'
import { config } from '../config'

export function devRouter(): Router {
    const router = Router()

    router.post('/dev/advance-epoch', async (req, res) => {
        try {
            const provider = new ethers.providers.JsonRpcProvider(
                config.provider
            )
            const unirep = new ethers.Contract(
                config.unirepAddress,
                [
                    'function attesterEpochLength(uint160 attesterId) public view returns (uint256)',
                ],
                provider
            )
            const epochLength = await unirep.attesterEpochLength(
                config.karmaBridgeAddress
            )
            await provider.send('evm_increaseTime', [Number(epochLength)])
            await provider.send('evm_mine', [])

            res.json({ success: true, advancedSeconds: Number(epochLength) })
        } catch (err: any) {
            console.error('[dev/advance-epoch] Error:', err)
            res.status(500).json({ success: false, error: err.message })
        }
    })

    return router
}
