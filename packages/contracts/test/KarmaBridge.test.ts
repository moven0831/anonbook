//@ts-ignore
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { deployUnirep } from '@unirep/contracts/deploy'
import { schema, UserState } from '@unirep/core'
import { SQLiteConnector } from 'anondb/node'
import { Identity } from '@semaphore-protocol/identity'
import { defaultProver as prover } from '@unirep-app/circuits/provers/defaultProver'

async function genUserState(id: any, app: any) {
    const db = await SQLiteConnector.create(schema, ':memory:')
    const unirepAddress = await app.unirep()
    const attesterId = BigInt(app.address)
    const userState = new UserState({
        db,
        prover,
        unirepAddress,
        provider: ethers.provider,
        attesterId,
        id,
    })
    await userState.start()
    await userState.waitForSync()
    return userState
}

describe('KarmaBridge', function () {
    let unirep: any
    let karmaBridge: any
    let owner: any
    let nonOwner: any

    const EPOCH_LENGTH = 300

    const id = new Identity()

    it('deployment', async function () {
        ;[owner, nonOwner] = await ethers.getSigners()
        unirep = await deployUnirep(owner)
        const KarmaBridge = await ethers.getContractFactory('KarmaBridge')
        karmaBridge = await KarmaBridge.deploy(unirep.address, EPOCH_LENGTH)
        await karmaBridge.deployed()
    })

    it('should register as an attester on deployment', async () => {
        const attesterId = BigInt(karmaBridge.address)
        const epochLength = await unirep.attesterEpochLength(attesterId)
        expect(epochLength).to.equal(EPOCH_LENGTH)
    })

    it('should allow owner to sign up a user', async () => {
        const userState = await genUserState(id, karmaBridge)

        const { publicSignals, proof } = await userState.genUserSignUpProof()
        const tx = await karmaBridge.userSignUp(publicSignals, proof)
        await tx.wait()
        userState.stop()
    })

    it('should attest karma to an epoch key', async () => {
        const userState = await genUserState(id, karmaBridge)

        const nonce = 0
        const { publicSignals, proof, epochKey, epoch } =
            await userState.genEpochKeyProof({ nonce })

        const tx = await karmaBridge.attestKarma(epochKey, epoch, 100)
        await tx.wait()
        userState.stop()
    })

    it('should verify karma after state transition', async () => {
        // Advance time past epoch
        await ethers.provider.send('evm_increaseTime', [EPOCH_LENGTH])
        await ethers.provider.send('evm_mine', [])

        const newEpoch = await unirep.attesterCurrentEpoch(
            karmaBridge.address
        )
        const userState = await genUserState(id, karmaBridge)
        const { publicSignals, proof } =
            await userState.genUserStateTransitionProof({
                toEpoch: newEpoch,
            })
        await unirep
            .userStateTransition(publicSignals, proof)
            .then((t: any) => t.wait())

        // Now check that user has the attested data
        await userState.waitForSync()
        const data = await userState.getProvableData()
        expect(data[0]).to.equal(BigInt(100))

        userState.stop()
    })

    it('should reject non-owner calls to userSignUp', async () => {
        const karmaBridgeAsNonOwner = karmaBridge.connect(nonOwner)
        const fakeId = new Identity()
        const userState = await genUserState(fakeId, karmaBridge)
        const { publicSignals, proof } = await userState.genUserSignUpProof()
        try {
            await karmaBridgeAsNonOwner.userSignUp(publicSignals, proof)
            expect.fail('should have reverted')
        } catch (err: any) {
            expect(err.message).to.include('Ownable: caller is not the owner')
        }
        userState.stop()
    })

    it('should reject non-owner calls to attestKarma', async () => {
        const karmaBridgeAsNonOwner = karmaBridge.connect(nonOwner)
        try {
            await karmaBridgeAsNonOwner.attestKarma(123, 0, 50)
            expect.fail('should have reverted')
        } catch (err: any) {
            expect(err.message).to.include('Ownable: caller is not the owner')
        }
    })
})
