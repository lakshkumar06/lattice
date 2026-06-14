# Setup

## Local

```bash
npm install
npm test
npm run e2e:local
```

`e2e:local` requires Foundry tools in `PATH` and starts its own Anvil process.

## Arc Deploy

Set:

```bash
ARC_RPC_URL=https://rpc.testnet.arc.network
PRIVATE_KEY=0x...
USDC_ADDRESS=0x3600000000000000000000000000000000000000
KEYSTONE_FORWARDER=0x...
MIN_RESERVE_BPS=2000
```

Then:

```bash
npm run deploy:arc
```

The deployer is the company borrower for that pool.

## Backend

Set:

```bash
STAKE_AND_ADVANCE_ADDRESS=0x...
RPC_URL=https://rpc.testnet.arc.network
CHAIN_ID=5042002
REPORTER_PRIVATE_KEY=0x...
```

`REPORTER_PRIVATE_KEY` must correspond to `KEYSTONE_FORWARDER`, because only that address can submit
`onReport`.

Optional Chainlink confidential inference:

```bash
CONFIDENTIAL_AI_ENDPOINT=https://...
CONFIDENTIAL_AI_API_KEY=...
```

When those are unset, the server uses the deterministic local model.
