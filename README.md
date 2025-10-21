# FlameKeeper Bot

FlameKeeper is the spiritual guide of the FlameBorn DAO Discord — bridging on-chain governance, impact, and community care. This starter template provides a working Node.js bot that connects to the Celo blockchain, verifies health actors, and streams donation impact directly into your server.

## Features

- 🔐 **Wallet Verification** — `!verify <address>` checks the HealthActorRegistry smart contract.
- 💧 **Impact Streaming** — `!impact` shares recent donations and subscribes the channel to live `DonationProcessed` events.
- 🔌 **Celo Connectivity** — Utility helpers wire the bot to Celo RPC endpoints via `ethers` v6.
- 🧱 **Modular Architecture** — Commands and utilities are organized for quick expansion (rewards, proposals, education, etc.).

## Prerequisites

- Node.js 18+
- A Discord bot token (create one in the [Discord Developer Portal](https://discord.com/developers/applications)).
- Access to the relevant Celo contracts:
  - HealthActorRegistry contract address
  - DonationRouter contract address

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in the required values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `DISCORD_TOKEN` | Discord bot token |
   | `CELO_RPC` | RPC endpoint for the Celo network (Alfajores by default) |
   | `REGISTRY_CONTRACT` | HealthActorRegistry contract address |
   | `DONATION_CONTRACT` | DonationRouter contract address |

3. **Start the bot**

   ```bash
   npm start
   ```

   The console should confirm: `🔥 FlameKeeper is online as <BotName>`.

## Command Reference

| Command | Description |
| --- | --- |
| `!verify <wallet>` | Confirms whether a wallet is a verified health actor. |
| `!impact` | Fetches the most recent donations and enables live updates in the channel. |

## Project Structure

```
.
├── commands/
│   ├── impact.js         # Donation feed command and event stream
│   └── verify.js         # Health actor verification command
├── utils/
│   ├── celo.js           # Celo RPC + contract helpers
│   └── embeds.js         # Discord embed templates
├── .env.example          # Required configuration variables
├── index.js              # Bot bootstrap and command loader
├── package.json
└── README.md
```

## Next Steps

- 🔗 Add `!linkwallet` to connect Discord IDs with verified wallets.
- 🗳️ Integrate Snapshot or GuardianDAO feeds for proposal alerts.
- 🎁 Build `!reward` transactions for LearnToEarn quests.
- 🛡️ Enforce role-based permissions so Guardians steward the flame.

## Security Notes

- Never commit your `.env` file — it contains sensitive tokens.
- Use a dedicated bot wallet with limited privileges for on-chain actions.
- Rotate tokens periodically and monitor bot activity with Discord audit logs.

Keep the Flame burning bright! 🔥
