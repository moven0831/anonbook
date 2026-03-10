# UniRep Reference Links

Use these links when you need to look up UniRep APIs, protocol details, or example code.

---

## Documentation (start here)

| Topic | URL |
|-------|-----|
| **Main docs** | https://developer.unirep.io/docs/welcome |
| What Can I Build | https://developer.unirep.io/docs/what-can-i-build |
| Getting Started / create-unirep-app | https://developer.unirep.io/docs/getting-started/create-unirep-app |
| Testnet Deployment | https://developer.unirep.io/docs/testnet-deployment |

## Protocol Concepts

| Topic | URL |
|-------|-----|
| Users & Attesters | https://developer.unirep.io/docs/protocol/users-and-attesters |
| Epoch Keys | https://developer.unirep.io/docs/protocol/epoch-key |
| FAQs | https://developer.unirep.io/docs/faqs |

## Package API References

These are the APIs you'll use directly in the relay and contract code.

| Package | Docs | What it's for |
|---------|------|---------------|
| `@unirep/core` | https://developer.unirep.io/docs/core-api/ | `UserState`, `genEpochKeyProof`, `genProveReputationProof`, `genUserSignUpProof` |
| `@unirep/contracts` | https://developer.unirep.io/docs/contracts-api/ | `IUnirep`, `EpochKeyVerifierHelper`, `deployUnirep` |
| `@unirep/circuits` | https://developer.unirep.io/docs/circuits-api/ | `defaultProver`, circuit types, proof classes (`SignupProof`, `EpochKeyProof`, `ReputationProof`) |
| `@unirep/utils` | https://developer.unirep.io/docs/utils-api/ | Helper functions (`genEpochTreeLeaf`, etc.) |

## Key GitHub Repositories

| Repo | URL | Relevance |
|------|-----|-----------|
| **Unirep** (main monorepo) | https://github.com/Unirep/Unirep | Core protocol source — contracts, circuits, core, utils packages |
| **create-unirep-app** | https://github.com/Unirep/create-unirep-app | Our scaffold source — study its relay, contracts, frontend structure |
| **Unirep-Social** | https://github.com/Unirep/Unirep-Social | Reference app — anonymous social media, closest to anonbook's use case |
| **demo** | https://github.com/Unirep/demo | Simple off-chain demo app |
| **explorer** | https://github.com/Unirep/explorer | On-chain data explorer, useful for debugging |

## Live Tools

| Tool | URL |
|------|-----|
| Explorer | https://explorer.unirep.io |
| Demo app | https://demo.unirep.pse.dev/ |

## Infrastructure Repos (reference only)

| Repo | URL | Notes |
|------|-----|-------|
| ceremony | https://github.com/Unirep/ceremony | Trusted setup ceremony for v2 circuits |
| trusted-setup | https://github.com/Unirep/trusted-setup | |
| auth | https://github.com/Unirep/auth | |
| halo2-prover | https://github.com/Unirep/halo2-prover | |
| ark-circom | https://github.com/Unirep/ark-circom | Arkworks bindings to Circom |
| devops | https://github.com/Unirep/devops | Infrastructure as code |
| Sign-up-with-Unirep | https://github.com/Unirep/Sign-up-with-Unirep | |

## Archived / Legacy (avoid unless debugging old versions)

| Repo | URL |
|------|-----|
| docs (old) | https://github.com/Unirep/docs |
| contracts (old) | https://github.com/Unirep/contracts |
| circuits (old) | https://github.com/Unirep/circuits |
| crypto (old) | https://github.com/Unirep/crypto |
| Unirep-Social-frontend | https://github.com/Unirep/Unirep-Social-frontend |
| Unirep-Social-backend | https://github.com/Unirep/Unirep-Social-backend |
| epoch-sealer | https://github.com/Unirep/epoch-sealer |

## Older Doc Versions

Only use these if you need to match a specific version:

| Version | URL |
|---------|-----|
| next | https://developer.unirep.io/docs/next/welcome |
| 2.0.0-beta-4 | https://developer.unirep.io/docs/2.0.0-beta-4/welcome |
| 1.0.1 | https://developer.unirep.io/docs/1.0.1/welcome |

## Audit Reports

| Audit | URL |
|-------|-----|
| PSE audit (v2.0.0-beta-1) | https://developer.unirep.io/assets/files/unirep_audit-651a144151b6837b723c9dccad26f894.pdf |
| Veridise audit (v2.0.0-beta-3) | https://developer.unirep.io/assets/files/VAR_Unirep-fd2248829d28ad53c4c2a01ef87d9015.pdf |

## Subgraph

For querying on-chain UniRep data: https://developer.unirep.io/docs/subgraph

## Blog

Protocol updates and announcements: https://developer.unirep.io/blog
