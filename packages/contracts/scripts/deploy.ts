import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'
import {
    deployUnirep,
    deployVerifierHelper,
} from '@unirep/contracts/deploy/index.js'
import { Circuit } from '@unirep/circuits'
import * as hardhat from 'hardhat'

const epochLength = 3600

deployApp().catch((err) => {
    console.log(`Uncaught error: ${err}`)
    process.exit(1)
})

export async function deployApp() {
    const [signer] = await ethers.getSigners()
    const unirep = await deployUnirep(signer)

    console.log(`UniRep deployed to: ${unirep.address}`)

    const epkHelper = await deployVerifierHelper(
        unirep.address,
        signer,
        Circuit.epochKey
    )

    const KarmaBridge = await ethers.getContractFactory('KarmaBridge')
    const karmaBridge = await KarmaBridge.deploy(
        unirep.address,
        epkHelper.address,
        epochLength
    )
    await karmaBridge.deployed()

    console.log(`KarmaBridge deployed to: ${karmaBridge.address}`)

    const config = `UNIREP_ADDRESS='${unirep.address}'
KARMA_BRIDGE_ADDRESS='${karmaBridge.address}'
ETH_PROVIDER_URL='${hardhat.network.config.url ?? ''}'
${
    Array.isArray(hardhat.network.config.accounts)
        ? `PRIVATE_KEY='${hardhat.network.config.accounts[0]}'`
        : `# This contract was deployed using a mnemonic. Set PRIVATE_KEY manually.`
}
`

    const configPath = path.join(__dirname, '../../relay/.env')
    await fs.promises.writeFile(configPath, config)

    console.log(`Config written to ${configPath}`)
}
