import { Identity } from '@semaphore-protocol/identity'
import { UserState } from '@unirep/core'
import { defaultProver as prover } from '@unirep/circuits/provers/defaultProver'
import { schema } from '@unirep/core'
import { SQLiteConnector } from 'anondb/node'
import { ethers } from 'ethers'
import { config } from '../config'
import crypto from 'crypto'

// --- Identity helpers ---

export function createIdentity(): {
    identity: Identity
    secret: string
    commitment: string
} {
    const identity = new Identity()
    return {
        identity,
        secret: identity.toString(),
        commitment: identity.commitment.toString(),
    }
}

export function loadIdentity(secret: string): Identity {
    return new Identity(secret)
}

// --- AES-256-GCM encryption for stored identities ---

export function encryptIdentity(identitySecret: string, key: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        crypto.createHash('sha256').update(key).digest(),
        iv
    )
    let encrypted = cipher.update(identitySecret, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const tag = cipher.getAuthTag().toString('hex')
    return `${iv.toString('hex')}:${tag}:${encrypted}`
}

export function decryptIdentity(encrypted: string, key: string): string {
    const [ivHex, tagHex, data] = encrypted.split(':')
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        crypto.createHash('sha256').update(key).digest(),
        Buffer.from(ivHex, 'hex')
    )
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    let decrypted = decipher.update(data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

// --- UserState helpers ---

export async function createUserState(identity: Identity): Promise<UserState> {
    const db = await SQLiteConnector.create(schema, ':memory:')
    const provider = new ethers.providers.JsonRpcProvider(config.provider)
    const userState = new UserState({
        db,
        prover,
        unirepAddress: config.unirepAddress,
        provider,
        attesterId: BigInt(config.karmaBridgeAddress),
        id: identity,
    })
    await userState.start()
    await userState.waitForSync()
    return userState
}

// --- Auto epoch transition ---

export async function ensureStateTransition(
    userState: UserState
): Promise<void> {
    const currentEpoch = await userState.latestTransitionedEpoch()
    const onChainEpoch = await userState.sync.loadCurrentEpoch()
    if (currentEpoch < onChainEpoch) {
        const { publicSignals, proof } =
            await userState.genUserStateTransitionProof({
                toEpoch: onChainEpoch,
            })
        const provider = new ethers.providers.JsonRpcProvider(config.provider)
        const wallet = new ethers.Wallet(config.privateKey, provider)
        const unirep = new ethers.Contract(
            config.unirepAddress,
            [
                'function userStateTransition(uint256[] memory publicSignals, uint256[8] memory proof) public',
            ],
            wallet
        )
        const tx = await unirep.userStateTransition(publicSignals, proof)
        await tx.wait()
        await userState.waitForSync()
    }
}
