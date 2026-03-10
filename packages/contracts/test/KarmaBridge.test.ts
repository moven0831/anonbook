//@ts-ignore
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { deployUnirep, deployVerifierHelper } from '@unirep/contracts/deploy'
import { schema, UserState } from '@unirep/core'
import { Circuit } from '@unirep/circuits'
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
    this.timeout(120_000)

    let unirep: any
    let karmaBridge: any
    let epkHelper: any
    let owner: any
    let nonOwner: any

    const EPOCH_LENGTH = 300
    const id = new Identity()

    it('deployment', async function () {
        ;[owner, nonOwner] = await ethers.getSigners()
        unirep = await deployUnirep(owner)

        epkHelper = await deployVerifierHelper(
            unirep.address,
            owner,
            Circuit.epochKey
        )

        const KarmaBridge = await ethers.getContractFactory('KarmaBridge')
        karmaBridge = await KarmaBridge.deploy(
            unirep.address,
            epkHelper.address,
            EPOCH_LENGTH
        )
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
        await karmaBridge
            .userSignUp(publicSignals, proof)
            .then((t: any) => t.wait())
        userState.stop()
    })

    it('should attest karma via epoch key proof', async () => {
        const userState = await genUserState(id, karmaBridge)
        const nonce = 0
        const { publicSignals, proof } = await userState.genEpochKeyProof({
            nonce,
        })
        const tx = await karmaBridge.attestKarma(publicSignals, proof, 100)
        await tx.wait()
        userState.stop()
    })

    it('should verify karma after state transition', async () => {
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

        let reverted = false
        try {
            await karmaBridgeAsNonOwner.userSignUp(publicSignals, proof)
        } catch (err: any) {
            reverted = err.message.includes(
                'Ownable: caller is not the owner'
            )
        }
        expect(reverted).to.be.true
        userState.stop()
    })

    it('should reject non-owner calls to attestKarma', async () => {
        const karmaBridgeAsNonOwner = karmaBridge.connect(nonOwner)
        const userState = await genUserState(id, karmaBridge)
        const nonce = 1
        const { publicSignals, proof } = await userState.genEpochKeyProof({
            nonce,
        })

        let reverted = false
        try {
            await karmaBridgeAsNonOwner.attestKarma(publicSignals, proof, 50)
        } catch (err: any) {
            reverted = err.message.includes(
                'Ownable: caller is not the owner'
            )
        }
        expect(reverted).to.be.true
        userState.stop()
    })

    it('should expose tier constants', async () => {
        expect((await karmaBridge.NEWCOMER()).toNumber()).to.equal(1)
        expect((await karmaBridge.CONTRIBUTOR()).toNumber()).to.equal(10)
        expect((await karmaBridge.TRUSTED()).toNumber()).to.equal(100)
        expect((await karmaBridge.LEGEND()).toNumber()).to.equal(1000)
    })
})
