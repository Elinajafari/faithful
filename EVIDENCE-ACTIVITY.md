# Evidence: Faithful, second round on GenLayer StudioNet

Every row below was read back from the chain by `scripts/evidence.mjs`: the
sender, the status and the outcome come from the node's answer for each hash,
not from the deployment record. Every outcome on chain matches the record.

- **Contract:** [`0xd91BB7Da22D3d4f672Eb346CeE6941c3557A98F1`](https://explorer-studio.genlayer.com/address/0xd91BB7Da22D3d4f672Eb346CeE6941c3557A98F1)
- **Round:** new wallets on the contract already deployed; no deploy in this round
- **The deployment itself:** [EVIDENCE.md](EVIDENCE.md)
- **Transactions:** 5, from 2 different wallets
- **Generated:** 2026-10-12 03:13 UTC

## Wallets

Each wallet was made in memory for this run, and its key was never written
anywhere. Click an address to see every transaction it sent.

| Role | Address | Transactions sent |
|---|---|---|
| client | [`0x6c9CEbd6eC252eFdcd760A8ad8f2886F489574B4`](https://explorer-studio.genlayer.com/address/0x6c9CEbd6eC252eFdcd760A8ad8f2886F489574B4) | 3 |
| translator | [`0xDB29B2b2a905D0Ac379A5d27abFf12dEdFE675C5`](https://explorer-studio.genlayer.com/address/0xDB29B2b2a905D0Ac379A5d27abFf12dEdFE675C5) | 2 |

## Transactions, in order

"refused" is a transaction the contract was meant to refuse: the committee
agreed on the refusal, and the sentence is the contract's own.

| # | Step | Sent by | Method | On chain | Outcome | Tx |
|---|---|---|---|---|---|---|
| 0 | job 3: a new client posts a station notice, 0.05 GEN | client [`0x6c9C…74B4`](https://explorer-studio.genlayer.com/address/0x6c9CEbd6eC252eFdcd760A8ad8f2886F489574B4) | `commission` | FINALIZED · MAJORITY_AGREE | executed | [`0x74f5379e…442e`](https://explorer-studio.genlayer.com/tx/0x74f5379e55b1e148a87f50fd2efd9cb38e1384c005becbdbe8c8d194ffed442e) |
| 1 | the client tries to claim it | client [`0x6c9C…74B4`](https://explorer-studio.genlayer.com/address/0x6c9CEbd6eC252eFdcd760A8ad8f2886F489574B4) | `claim` | FINALIZED · MAJORITY_AGREE | refused: the client cannot claim its own job | [`0xe1e3f8f2…82bf`](https://explorer-studio.genlayer.com/tx/0xe1e3f8f25e588178ad079f222e8074ca648934c7f7df6c936b35a657a24b82bf) |
| 2 | a new translator claims it | translator [`0xDB29…75C5`](https://explorer-studio.genlayer.com/address/0xDB29B2b2a905D0Ac379A5d27abFf12dEdFE675C5) | `claim` | FINALIZED · MAJORITY_AGREE | executed | [`0xe1ac6372…82d8`](https://explorer-studio.genlayer.com/tx/0xe1ac63724758867c170dba7ac1e10b42ab58a74d46f2ecf92da4eed6b22182d8) |
| 3 | the client tries to deliver it | client [`0x6c9C…74B4`](https://explorer-studio.genlayer.com/address/0x6c9CEbd6eC252eFdcd760A8ad8f2886F489574B4) | `deliver` | FINALIZED · MAJORITY_AGREE | refused: only the translator who claimed this job may deliver | [`0xfe2362ba…192f`](https://explorer-studio.genlayer.com/tx/0xfe2362bae0bf6cb7b2e8affcd96b8de1bde9dfb5d73d32a7dad8a3ad2b8d192f) |
| 4 | delivered and ruled: both orders (expected faithful) | translator [`0xDB29…75C5`](https://explorer-studio.genlayer.com/address/0xDB29B2b2a905D0Ac379A5d27abFf12dEdFE675C5) | `deliver` | FINALIZED · MAJORITY_AGREE | executed | [`0xc697e2aa…2631`](https://explorer-studio.genlayer.com/tx/0xc697e2aa52ed4c1619648484d345a3347e8a4bf02a84687e0da100c03eab2631) |
