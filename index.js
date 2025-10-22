import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import { ethers } from "ethers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHttp } from "./http.js";
import * as verifyCommand from "./commands/verify.js";
import * as impactCommand from "./commands/impact.js";
import * as linkWalletCommand from "./commands/linkwallet.js";
import * as assignRoleCommand from "./commands/assignrole.js";
import { FlameBornEngine } from "./utils/celo.js";
import { createEventEmbed } from "./utils/embeds.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, ".env") });

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const DONATIONS_CHANNEL_ID = process.env.DONATIONS_CHANNEL_ID;
const PORT = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnv = [
  "DISCORD_TOKEN",
  "CELO_RPC",
  "FLB_TOKEN_CONTRACT",
  "FLB_ENGINE_CONTRACT",
  "FLB_HEALTHIDNFT_CONTRACT",
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// Verify Discord token format
if (!DISCORD_TOKEN || DISCORD_TOKEN.trim() === "" || DISCORD_TOKEN === "your_token_here") {
  console.error("❌ Invalid DISCORD_TOKEN in .env file");
  console.error("Please set a valid bot token from https://discord.com/developers/applications");
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully");

// Initialize Discord client
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

let celoListenersRegistered = false;

/**
 * Post donation event to Discord channel
 */
async function postDonation({ donor, beneficiary, amountWei, txHash }) {
  if (!DONATIONS_CHANNEL_ID) {
    console.warn("⚠️  DONATIONS_CHANNEL_ID not set, skipping donation post");
    return;
  }
  
  try {
    const channel = await discordClient.channels.fetch(DONATIONS_CHANNEL_ID);
    if (!channel?.isTextBased()) {
      console.error("❌ Donations channel is not text-based");
      return;
    }
    
    const formattedAmount = ethers.formatEther(amountWei ?? 0n);
    const details = [
      `**Donor:** ${donor}`,
      `**Beneficiary:** ${beneficiary}`,
      `**Amount:** ${formattedAmount} CELO`,
    ];
    
    if (txHash) {
      details.push(`**Tx:** [${txHash.slice(0, 10)}...](https://celoscan.io/tx/${txHash})`);
    }
    
    const embed = createEventEmbed("💧 Proof of Healing Recorded", details.join("\n"));
    await channel.send({ embeds: [embed] });
    console.log(`✅ Posted donation from ${donor.slice(0, 8)}...`);
  } catch (error) {
    console.error("❌ Failed to post donation:", error.message);
  }
}

/**
 * Setup Celo blockchain event listeners
 */
function setupCeloListeners() {
  if (celoListenersRegistered || !DONATIONS_CHANNEL_ID) return;
  
  celoListenersRegistered = true;
  console.log("🔗 Setting up Celo event listeners...");
  
  FlameBornEngine.on("DonationProcessed", async (donor, amount, beneficiary, event) => {
    console.log("📥 DonationProcessed event received");
    await postDonation({
      donor,
      beneficiary,
      amountWei: amount,
      txHash: event?.transactionHash,
    });
  });
  
  console.log("✅ Celo listeners registered");
}

/**
 * Start HTTP server for health checks and webhooks
 */
if (PORT) {
  try {
    const app = createHttp({
      discordClient,
      postDonation,
      runSyncStructure: async ({ dry }) => {
        if (!GUILD_ID) throw new Error("GUILD_ID is required for structure sync");
        console.log(`🔄 Running structure sync (dry run: ${dry})`);
        
        const guild = await discordClient.guilds.fetch(GUILD_ID);
        const roles = await guild.roles.fetch();
        const channels = await guild.channels.fetch();

        return {
          roles: roles.map((r) => ({ id: r.id, name: r.name })),
          channels: channels.map((c) => ({ id: c.id, name: c.name })),
        };
      },
    });
    
    app.listen(PORT, () => {
      console.log(`🌐 HTTP server listening on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start HTTP server:", error.message);
  }
}

/**
 * Discord bot ready event
 */
discordClient.once("ready", () => {
  console.log("🔥 FlameKeeper Bot is online and ready!");
  console.log(`📛 Logged in as: ${discordClient.user.tag}`);
  console.log(`🏢 Serving ${discordClient.guilds.cache.size} guild(s)`);
  setupCeloListeners();
});

/**
 * Command prefix and handlers
 */
const prefix = "!";

const commandHandlers = new Map([
  ["ping", async (message) => {
    const sent = await message.channel.send("🏓 Pinging...");
    const latency = sent.createdTimestamp - message.createdTimestamp;
    await sent.edit(`🏓 Pong! Latency: ${latency}ms | API: ${Math.round(discordClient.ws.ping)}ms`);
  }],
  ["verify", (message, args) => verifyCommand.execute(message, args)],
  ["impact", (message) => impactCommand.execute(message)],
  ["linkwallet", (message, args) => linkWalletCommand.execute(message, args)],
  ["assignrole", (message, args) => assignRoleCommand.execute(message, args)],
  ["help", async (message) => {
    const commands = Array.from(commandHandlers.keys()).map(cmd => `\`${prefix}${cmd}\``).join(", ");
    await message.channel.send(`📋 **Available Commands:**\n${commands}`);
  }],
]);

/**
 * Message command handler
 */
discordClient.on("messageCreate", async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Check for command prefix
  if (!message.content.startsWith(prefix)) return;

  // Parse command and arguments
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  // Find and execute command
  const handler = commandHandlers.get(commandName);
  if (!handler) {
    await message.reply(`❌ Unknown command. Use \`${prefix}help\` to see available commands.`);
    return;
  }

  try {
    console.log(`⚡ Executing command: ${commandName} by ${message.author.tag}`);
    await handler(message, args);
  } catch (error) {
    console.error(`❌ Error executing command ${commandName}:`, error);
    await message.reply("❌ An error occurred while executing that command.");
  }
});

/**
 * Error handling
 */
discordClient.on("error", (error) => {
  console.error("❌ Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

process.on("SIGINT", () => {
  console.log("\n👋 Shutting down gracefully...");
  discordClient.destroy();
  process.exit(0);
});

/**
 * Login to Discord
 */
console.log("🔐 Logging in to Discord...");
discordClient.login(DISCORD_TOKEN.trim()).catch((error) => {
  console.error("❌ Failed to login to Discord:", error.message);
  console.error("\n🔧 Troubleshooting steps:");
  console.error("1. Go to https://discord.com/developers/applications");
  console.error("2. Select your bot application");
  console.error("3. Go to 'Bot' tab and click 'Reset Token'");
  console.error("4. Copy the new token and update your .env file");
  console.error("5. Make sure MESSAGE CONTENT INTENT is enabled in Bot settings");
  process.exit(1);
});