# Chunk 1: Scaffold + Contract

> **Parent plan:** `2026-03-10-anonbook-plan-index.md`
> **Spec:** `docs/superpowers/specs/2026-03-10-anonbook-design.md`
> **UniRep References:** `docs/superpowers/references/unirep-references.md` — consult for contract APIs (`@unirep/contracts`), deploy helpers, and `create-unirep-app` scaffold structure
> **Dependencies:** None — this is the first chunk
> **Blocks:** Chunk 2, 3, 4, 5

---

### Task 1: Scaffold the monorepo

**Files:**
- Create: entire project via `npx create-unirep-app`

- [ ] **Step 1: Generate scaffold**

```bash
cd /Users/moventsai/Projects/mine/anonbook
npx create-unirep-app anonbook-scaffold
```

Follow prompts to generate the scaffold. If it creates a subdirectory, we'll move contents up.

- [ ] **Step 2: Move scaffold contents into repo root**

Move generated files from `anonbook-scaffold/` into the repo root, preserving the existing `docs/` and `.claude/` directories. Do NOT overwrite existing files.

```bash
# Copy scaffold contents (excluding .git) into repo root
rsync -a --exclude='.git' anonbook-scaffold/ .
rm -rf anonbook-scaffold
```

- [ ] **Step 3: Install dependencies**

```bash
yarn install
```

Expected: successful install with packages/ workspace detected.

- [ ] **Step 4: Verify scaffold builds**

```bash
yarn build
```

Expected: contracts compile, relay builds, frontend builds (we'll replace frontend later).

- [ ] **Step 5: Verify local Hardhat node works**

In one terminal:
```bash
yarn contracts hardhat node
```

In another:
```bash
yarn contracts deploy
```

Expected: UniRep contract deployed to localhost, address printed.

- [ ] **Step 6: Commit scaffold**

```bash
git add -A
git commit -m "feat: scaffold monorepo via create-unirep-app"
```

---

### Task 2: Implement KarmaBridge contract

**Files:**
- Create: `packages/contracts/contracts/KarmaBridge.sol`
- Modify: `packages/contracts/deploy/deploy.ts`

- [ ] **Step 1: Write KarmaBridge contract test**

Create `packages/contracts/test/KarmaBridge.test.ts`:

```typescript
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { deployUnirep } from '@unirep/contracts/deploy'
import { UserState } from '@unirep/core'
import { defaultProver } from '@unirep/circuits/provers/defaultProver'
import { Identity } from '@semaphore-protocol/identity'

describe('KarmaBridge', function () {
  let unirep: any
  let karmaBridge: any
  let owner: any
  let nonOwner: any

  const EPOCH_LENGTH = 300 // 5 min for tests

  beforeEach(async () => {
    ;[owner, nonOwner] = await ethers.getSigners()
    // Deploy UniRep
    unirep = await deployUnirep(owner)
    // Deploy KarmaBridge
    const KarmaBridge = await ethers.getContractFactory('KarmaBridge')
    const epkVerifierAddress = await unirep.epochKeyVerifierHelper()
    karmaBridge = await KarmaBridge.deploy(
      unirep.address,
      epkVerifierAddress,
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
    const identity = new Identity()
    const userState = new UserState({
      prover: defaultProver,
      unirepAddress: unirep.address,
      provider: owner.provider,
      id: identity,
      attesterId: BigInt(karmaBridge.address),
    })
    await userState.start()
    await userState.waitForSync()

    const { publicSignals, proof } = await userState.genUserSignUpProof()
    const tx = await karmaBridge.userSignUp(publicSignals, proof)
    await tx.wait()
    // Verify user is registered (check on-chain state)
  })

  it('should attest karma to an epoch key', async () => {
    // Sign up user first, then generate epoch key proof, then attest
    // ... full flow test
  })

  it('should reject non-owner calls', async () => {
    const identity = new Identity()
    const karmaBridgeAsNonOwner = karmaBridge.connect(nonOwner)
    await expect(
      karmaBridgeAsNonOwner.userSignUp([], [0,0,0,0,0,0,0,0])
    ).to.be.revertedWith('Ownable: caller is not the owner')
  })
})
```

Note: The exact prover import path depends on the UniRep version the scaffold installs. Check the scaffold's existing tests in `packages/contracts/test/` after scaffolding. Common alternatives: `@unirep/circuits/provers/defaultProver` or a local prover setup. The `defaultProver` uses Node.js snarkjs which is suitable for testing.

**Semaphore Identity version note**: The `@semaphore-protocol/identity` API changed between v3 and v4 (constructor, serialization/deserialization methods). After scaffolding, verify which version is installed and adapt `new Identity()`, serialization (`identity.toString()` vs other methods), and deserialization patterns accordingly.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/contracts
npx hardhat test test/KarmaBridge.test.ts
```

Expected: FAIL — KarmaBridge contract doesn't exist yet.

- [ ] **Step 3: Write KarmaBridge.sol**

Create `packages/contracts/contracts/KarmaBridge.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@unirep/contracts/interfaces/IUnirep.sol";
import "@unirep/contracts/verifierHelpers/EpochKeyVerifierHelper.sol";

contract KarmaBridge is Ownable {
    IUnirep public immutable unirep;
    EpochKeyVerifierHelper public immutable epkVerifier;

    // Tier thresholds (for reference; proofs are verified on-chain)
    uint256 public constant NEWCOMER = 1;
    uint256 public constant CONTRIBUTOR = 10;
    uint256 public constant TRUSTED = 100;
    uint256 public constant LEGEND = 1000;

    constructor(
        IUnirep _unirep,
        EpochKeyVerifierHelper _epkVerifier,
        uint48 _epochLength
    ) {
        unirep = _unirep;
        epkVerifier = _epkVerifier;
        unirep.attesterSignUp(_epochLength);
    }

    function userSignUp(
        uint256[] memory publicSignals,
        uint256[8] memory proof
    ) public onlyOwner {
        unirep.userSignUp(publicSignals, proof);
    }

    function attestKarma(
        uint256[] memory publicSignals,
        uint256[8] memory proof,
        uint256 karma
    ) public onlyOwner {
        // Verify epoch key proof on-chain
        epkVerifier.verifyAndCheckCaller(publicSignals, proof);

        // Decode signals
        EpochKeyVerifierHelper.EpochKeySignals memory signals =
            epkVerifier.decodeEpochKeySignals(publicSignals);

        // Get current epoch for this attester
        uint160 attesterId = uint160(address(this));
        uint48 targetEpoch = unirep.attesterCurrentEpoch(attesterId);

        // Verify state tree root
        require(
            unirep.attesterStateTreeRootExists(
                attesterId,
                targetEpoch,
                signals.stateTreeRoot
            ),
            "Invalid state tree root"
        );

        // Attest karma into data[0]
        unirep.attest(signals.epochKey, targetEpoch, 0, karma);
    }
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/contracts
npx hardhat test test/KarmaBridge.test.ts
```

Expected: All tests pass. If there are import path issues, check the scaffold's existing contracts for the correct import paths for `IUnirep`, `EpochKeyVerifierHelper`, etc.

- [ ] **Step 5: Update deploy script**

Modify `packages/contracts/deploy/deploy.ts` to deploy KarmaBridge after UniRep:

```typescript
// After deploying UniRep...
const epkVerifierAddress = await unirep.epochKeyVerifierHelper()
const KarmaBridge = await ethers.getContractFactory('KarmaBridge')
const karmaBridge = await KarmaBridge.deploy(
  unirep.address,
  epkVerifierAddress,
  3600 // 1 hour epoch length
)
await karmaBridge.deployed()
console.log('KarmaBridge deployed to:', karmaBridge.address)
```

- [ ] **Step 6: Test deploy to local node**

Terminal 1: `yarn contracts hardhat node`
Terminal 2: `yarn contracts deploy`

Expected: Both UniRep and KarmaBridge addresses printed.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/contracts/KarmaBridge.sol packages/contracts/test/KarmaBridge.test.ts packages/contracts/deploy/deploy.ts
git commit -m "feat: implement KarmaBridge attester contract with tests"
```
