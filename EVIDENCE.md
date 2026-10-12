# Evidence: Faithful on GenLayer StudioNet

Every row below was read back from the chain by `scripts/evidence.mjs`: the
sender, the status and the outcome come from the node's answer for each hash,
not from the deployment record. Every outcome on chain matches the record.

- **Contract:** [`0xd91BB7Da22D3d4f672Eb346CeE6941c3557A98F1`](https://explorer-studio.genlayer.com/address/0xd91BB7Da22D3d4f672Eb346CeE6941c3557A98F1)
- **Deploy transaction:** [`0x9bf92639…cb84`](https://explorer-studio.genlayer.com/tx/0x9bf92639c23e6b531e9149da90b56a2f81c8bcb031dc3ccfa20d38796065cb84)
- **Source sha256:** `a4766a3374fa4275fa38094fb104b14c24d10299f3665f3b539e5af15db714e3`
- **Transactions:** 18, from 6 different wallets
- **Generated:** 2026-10-12 03:13 UTC

## Wallets

Each wallet was made in memory for this run, and its key was never written
anywhere. Click an address to see every transaction it sent.

| Role | Address | Transactions sent |
|---|---|---|
| deployer | [`0xF03D2ac2f84a4602Ba850F6943C4CFEC3A7AFc65`](https://explorer-studio.genlayer.com/address/0xF03D2ac2f84a4602Ba850F6943C4CFEC3A7AFc65) | 1 |
| client | [`0x58a058D32C018937f28baA28d665090516de67b8`](https://explorer-studio.genlayer.com/address/0x58a058D32C018937f28baA28d665090516de67b8) | 4 |
| stranger | [`0xd513FB0fA80805F24b700fe90E97EF23572271C1`](https://explorer-studio.genlayer.com/address/0xd513FB0fA80805F24b700fe90E97EF23572271C1) | 3 |
| ann | [`0x23DFC34685aCE7087fDb6C36EC2C3Ce480651E3a`](https://explorer-studio.genlayer.com/address/0x23DFC34685aCE7087fDb6C36EC2C3Ce480651E3a) | 3 |
| ben | [`0xCa23813aBCc248d2E34B096A179326BD5FE42310`](https://explorer-studio.genlayer.com/address/0xCa23813aBCc248d2E34B096A179326BD5FE42310) | 5 |
| cal | [`0x2df08c8795d905B7aF4852F31D1ac8b2Bb0a4dF7`](https://explorer-studio.genlayer.com/address/0x2df08c8795d905B7aF4852F31D1ac8b2Bb0a4dF7) | 2 |

## Transactions, in order

"refused" is a transaction the contract was meant to refuse: the committee
agreed on the refusal, and the sentence is the contract's own.

| # | Step | Sent by | Method | On chain | Outcome | Tx |
|---|---|---|---|---|---|---|
| 0 | deploy | deployer [`0xF03D…Fc65`](https://explorer-studio.genlayer.com/address/0xF03D2ac2f84a4602Ba850F6943C4CFEC3A7AFc65) | `deploy` | FINALIZED · MAJORITY_AGREE | executed | [`0x9bf92639…cb84`](https://explorer-studio.genlayer.com/tx/0x9bf92639c23e6b531e9149da90b56a2f81c8bcb031dc3ccfa20d38796065cb84) |
| 1 | job 0: a pharmacy leaflet, 0.3 GEN | client [`0x58a0…67b8`](https://explorer-studio.genlayer.com/address/0x58a058D32C018937f28baA28d665090516de67b8) | `commission` | FINALIZED · MAJORITY_AGREE | executed | [`0x9054507c…da0b`](https://explorer-studio.genlayer.com/tx/0x9054507ca0fa6c1ed7a144c782f1c251dcd91ff26073fa9ca934e0c72b60da0b) |
| 2 | job 1: a tenancy notice, 0.2 GEN | client [`0x58a0…67b8`](https://explorer-studio.genlayer.com/address/0x58a058D32C018937f28baA28d665090516de67b8) | `commission` | FINALIZED · MAJORITY_AGREE | executed | [`0xbf835d0c…21be`](https://explorer-studio.genlayer.com/tx/0xbf835d0c17cb5745db3d0d1293a556ec7a8535e9bf5bee6b050b3c1a6f0d21be) |
| 3 | job 2: a shop sign, 0.1 GEN | client [`0x58a0…67b8`](https://explorer-studio.genlayer.com/address/0x58a058D32C018937f28baA28d665090516de67b8) | `commission` | FINALIZED · MAJORITY_AGREE | executed | [`0x2e776836…63bf`](https://explorer-studio.genlayer.com/tx/0x2e7768363e6b7970284bbd65ee0640986ab2420a58e6fe5987a83f6c37ee63bf) |
| 4 | a release before the sign's deadline | stranger [`0xd513…71C1`](https://explorer-studio.genlayer.com/address/0xd513FB0fA80805F24b700fe90E97EF23572271C1) | `release` | FINALIZED · MAJORITY_AGREE | refused: the job is open until 2026-10-12T03:06:05Z | [`0x0e9c6d05…2660`](https://explorer-studio.genlayer.com/tx/0x0e9c6d052e3a32bde70efa10e39aa18753e09f178a1aab98cc649f1606ff2660) |
| 5 | the client claims its own job | client [`0x58a0…67b8`](https://explorer-studio.genlayer.com/address/0x58a058D32C018937f28baA28d665090516de67b8) | `claim` | FINALIZED · MAJORITY_AGREE | refused: the client cannot claim its own job | [`0x6072a2aa…2016`](https://explorer-studio.genlayer.com/tx/0x6072a2aa4f7839501c79574954e87443d3377001652b6bc8e179a010bf112016) |
| 6 | Ann claims the leaflet | ann [`0x23DF…1E3a`](https://explorer-studio.genlayer.com/address/0x23DFC34685aCE7087fDb6C36EC2C3Ce480651E3a) | `claim` | FINALIZED · MAJORITY_AGREE | executed | [`0x3cd48e14…c055`](https://explorer-studio.genlayer.com/tx/0x3cd48e14c5d1cc3b38b0db2bf6565f82319106766a40f0245e83eb5d9d1ec055) |
| 7 | Ben claims the leaflet too | ben [`0xCa23…2310`](https://explorer-studio.genlayer.com/address/0xCa23813aBCc248d2E34B096A179326BD5FE42310) | `claim` | FINALIZED · MAJORITY_AGREE | refused: this job is claimed; only an open job is claimed | [`0x64d28fd5…99b2`](https://explorer-studio.genlayer.com/tx/0x64d28fd5040d99a58d4605fd11901d54356246cf3ba6ba9e0f78293bc45599b2) |
| 8 | Ben claims the tenancy notice | ben [`0xCa23…2310`](https://explorer-studio.genlayer.com/address/0xCa23813aBCc248d2E34B096A179326BD5FE42310) | `claim` | FINALIZED · MAJORITY_AGREE | executed | [`0x6a18f6a4…b9c4`](https://explorer-studio.genlayer.com/tx/0x6a18f6a498ee68aac7a42de6b98a92aba92fc89ea8b7aa87cc88abc693c5b9c4) |
| 9 | Cal claims the shop sign | cal [`0x2df0…4dF7`](https://explorer-studio.genlayer.com/address/0x2df08c8795d905B7aF4852F31D1ac8b2Bb0a4dF7) | `claim` | FINALIZED · MAJORITY_AGREE | executed | [`0x3c53c431…8981`](https://explorer-studio.genlayer.com/tx/0x3c53c431e378d86dd776f227d928fd797dfd368e57125b54528b24741c538981) |
| 10 | a stranger delivers the leaflet | stranger [`0xd513…71C1`](https://explorer-studio.genlayer.com/address/0xd513FB0fA80805F24b700fe90E97EF23572271C1) | `deliver` | FINALIZED · MAJORITY_AGREE | refused: only the translator who claimed this job may deliver | [`0x07acae78…1acd`](https://explorer-studio.genlayer.com/tx/0x07acae7887b1f4858adb05efddc6da5dcdea7350ff524318faa212e32cb51acd) |
| 11 | the leaflet, 1st try: once a day, no alcohol line | ann [`0x23DF…1E3a`](https://explorer-studio.genlayer.com/address/0x23DFC34685aCE7087fDb6C36EC2C3Ce480651E3a) | `deliver` | FINALIZED · MAJORITY_AGREE | executed | [`0x6512065a…14f1`](https://explorer-studio.genlayer.com/tx/0x6512065a3c9c9bcf1c640ba3eb4ed864c80ba9d46826627ae0d1ef55a42014f1) |
| 12 | the leaflet, 2nd try | ann [`0x23DF…1E3a`](https://explorer-studio.genlayer.com/address/0x23DFC34685aCE7087fDb6C36EC2C3Ce480651E3a) | `deliver` | FINALIZED · MAJORITY_AGREE | executed | [`0x37a63d81…b380`](https://explorer-studio.genlayer.com/tx/0x37a63d81be9e781e6182f0017badce751e285d906b57af2456267c3103ebb380) |
| 13 | the tenancy, 1st try: 570 pounds, thirty days | ben [`0xCa23…2310`](https://explorer-studio.genlayer.com/address/0xCa23813aBCc248d2E34B096A179326BD5FE42310) | `deliver` | FINALIZED · MAJORITY_AGREE | executed | [`0xbd8613e3…d883`](https://explorer-studio.genlayer.com/tx/0xbd8613e3d34e9b84058a1793e128bb4b36c055f27bda69722df3fc64afc8d883) |
| 14 | the tenancy, 2nd try: in French | ben [`0xCa23…2310`](https://explorer-studio.genlayer.com/address/0xCa23813aBCc248d2E34B096A179326BD5FE42310) | `deliver` | FINALIZED · MAJORITY_AGREE | executed | [`0x7396e707…b9ab`](https://explorer-studio.genlayer.com/tx/0x7396e707868988b2c49563431c50925500e4db32bdbd052d8d1e5758e9d8b9ab) |
| 15 | the tenancy, a third try | ben [`0xCa23…2310`](https://explorer-studio.genlayer.com/address/0xCa23813aBCc248d2E34B096A179326BD5FE42310) | `deliver` | FINALIZED · MAJORITY_AGREE | refused: this job is refunded; only a claimed job takes a delivery | [`0xc5f1dfe2…1e5d`](https://explorer-studio.genlayer.com/tx/0xc5f1dfe21ced90e05146f2b7a41f76d5029772909549b1a98e0ba5a609af1e5d) |
| 16 | the sign delivered after its deadline | cal [`0x2df0…4dF7`](https://explorer-studio.genlayer.com/address/0x2df08c8795d905B7aF4852F31D1ac8b2Bb0a4dF7) | `deliver` | FINALIZED · MAJORITY_AGREE | refused: delivery closed at 2026-10-12T03:06:05Z; a late translation is never ruled, and release() refunds the client | [`0x29547351…9529`](https://explorer-studio.genlayer.com/tx/0x29547351c7029bfcbfc553fc4ff279ff7b4f9fcd27b79048b94685265c6e9529) |
| 17 | the sign released: the client refunded | stranger [`0xd513…71C1`](https://explorer-studio.genlayer.com/address/0xd513FB0fA80805F24b700fe90E97EF23572271C1) | `release` | FINALIZED · MAJORITY_AGREE | executed | [`0xcef8137c…5187`](https://explorer-studio.genlayer.com/tx/0xcef8137cfd5337bb48fb30a80f6ffc0273b133106abbc28c3d667af56cc75187) |
