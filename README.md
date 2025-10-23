# 🔥 FlameKeeper — FlameBorn DAO Discord Bridge (Celo Alfajores)

FlameKeeper connects the FlameBorn DAO Discord community directly to on-chain activity on the **Celo Alfajores Network (Chain ID: 44787)**. It monitors verified Health Actors, tracks donations, and broadcasts "Proof of Healing" events in real time.

---

## 🌍 Verified Contracts

| Contract | Address | Description |
|-----------|----------|--------------|
| **FlameBornToken (Proxy)** | `0x2806D0C068E0Bdd553Fd9d533C40cAFA6657b5f1` | ERC20 Upgradeable Token |
| **FlameBornEngine (Proxy)** | `0x82cA6C5FE9d7E834D908a2482aB76A51D64f5BB4` | Learn-to-Earn Engine |
| **FlameBornHealthIDNFT** | `0x1566c75a1Bad93a9fa5E2Da690395987E36e08e8` | Soulbound NFT for Health Verification |

---

## 🧾 Environment Variables

Copy `.env.example` to `.env` and fill in any secrets:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Discord bot token |
| `GUILD_ID` | Discord server ID (optional, for future role sync) |
| `DONATION_FEED_CHANNEL` | Channel ID for automatic donation posts (optional) |
| `CELO_RPC` | RPC endpoint for the Celo Alfajores network |
| `FLB_TOKEN_CONTRACT` | FlameBornToken proxy address |
| `FLB_ENGINE_CONTRACT` | FlameBornEngine proxy address |
| `FLB_HEALTHIDNFT_CONTRACT` | FlameBornHealthIDNFT contract address |
| `CHAIN_ID` | 44787 (Celo Alfajores) |

---

## 🧩 Commands

| Command | Description |
|----------|--------------|
| `!verify <wallet>` | Confirms if a wallet holds a HealthID NFT |
| `!impact` | Streams live `DonationProcessed` events |
| `!linkwallet <wallet>` | Placeholder for Codex wallet linking integration |
| `!assignrole` | Placeholder for Codex role synchronization |

---

## ⚙️ Setup

```bash
npm install
npm start
```

Console output:

```
🔥 FlameKeeper connected as FlameKeeper#0001 | Network: Celo Alfajores
```

In Discord:

```
!verify 0x...
!impact
```

---

## 🧱 Project Structure

```
flamekeeper/
├── index.js
├── commands/
│   ├── verify.js
│   ├── impact.js
│   ├── linkwallet.js
│   └── assignrole.js
├── utils/
│   ├── celo.js
│   └── embeds.js
├── .env.example
├── package.json
└── README.md
```

---

## 🧠 Network Info

- **Chain ID:** 44787
- **RPC:** <https://alfajores-forno.celo-testnet.org>
- **Explorer:** <https://celo-alfajores.blockscout.com/>

---

## 🔐 Security Notes

- All contract addresses sourced from `PROVENANCE.md` deployments.
- The bot runs in read-only mode (no private keys required).
- Never commit `.env` or share your Discord token publicly.

---

## 🕯️ Example Output

```
💧 Proof of Healing Recorded
Donor: 0x6d...2F
Beneficiary: 0x1b...A9
Amount: 10 CELO
```

Keep the Flame burning bright! 🔥
