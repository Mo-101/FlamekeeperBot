import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHttp } from './http.js';
import { ethers } from 'ethers';
import { createEventEmbed } from './utils/embeds.js';

// Configure dotenv
config({ override: true });

const requiredEnv = [
  'DISCORD_TOKEN',
  'CELO_RPC',
  'FLB_TOKEN_CONTRACT',
  'FLB_ENGINE_CONTRACT',
  'FLB_HEALTHIDNFT_CONTRACT',
  'ADMIN_API_KEY',
  'WEBHOOK_SECRET',
  'GUILD_ID'
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
const prefix = '!';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function registerCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  const files = await readdir(commandsDir);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const fileUrl = pathToFileURL(path.join(commandsDir, file)).href;
    const commandModule = await import(fileUrl);
    const { data, execute } = commandModule;
    if (!data?.name || typeof execute !== 'function') {
      console.warn(`⚠️  Skipping command at ${file} because it is missing a name or execute handler.`);
      continue;
    }
    client.commands.set(data.name, commandModule);
  }
}

await registerCommands();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🔥 FlameKeeper connected as ${readyClient.user.tag} | Network: Celo Alfajores`);
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) {
    return;
  }

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    await message.reply('🔥 The Flame flickered unexpectedly. Please try again later.');
  }
});

// Helper function to post a donation embed to a configured channel
async function postDonationToDiscord({ donor, beneficiary, amountWei, txHash }) {
  const channelId = process.env.DONATIONS_CHANNEL_ID;
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) return;

  const amount = ethers.formatEther(amountWei);
  const desc = `**Donor:** ${donor}\n**Beneficiary:** ${beneficiary}\n**Amount:** ${amount} CELO${txHash ? `\n**Tx:** ${txHash}` : ''}`;
  const embed = createEventEmbed('💧 Proof of Healing Recorded', desc);
  await channel.send({ embeds: [embed] });
}

// Allow HTTP layer to call your syncstructure code (trigger via command or function)
async function runSyncStructure({ dry }) {
  // simplest: send the command into the channel where you run ops, or invoke command logic directly.
  // If your syncstructure is implemented as a command file exporting execute(), import and call it here.
  try {
    const { execute } = await import('./commands/syncstructure.js');
    // pick a channel where the bot has permission to send messages (optional for logs)
    const channelId = process.env.ANNOUNCE_CHANNEL_ID || process.env.DONATIONS_CHANNEL_ID;
    const channel = channelId ? await client.channels.fetch(channelId) : null;
    const fakeMessage = channel ? { guild: channel.guild, channel, member: await channel.guild.members.fetchMe(), reply: (...a) => channel.send(...a) } : { guild: null };
    await execute(fakeMessage, [dry ? 'dry' : '']);
    return { status: dry ? 'dry-run' : 'applied' };
  } catch (e) {
    console.error('runSyncStructure failed', e);
    throw e;
  }
}

// Configure the HTTP server
const port = process.env.PORT;
if (port) {
  const app = createHttp({ discordClient: client, postDonation: postDonationToDiscord, runSyncStructure });
  app.listen(port, () => console.log(`HTTP server listening on :${port}`));
}

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);