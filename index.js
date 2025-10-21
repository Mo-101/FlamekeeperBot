import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

config();

const requiredEnv = ['DISCORD_TOKEN', 'CELO_RPC', 'REGISTRY_CONTRACT', 'DONATION_CONTRACT'];
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
    const { data, execute, onInit } = commandModule;
    if (!data?.name || typeof execute !== 'function') {
      console.warn(`⚠️  Skipping command at ${file} because it is missing a name or execute handler.`);
      continue;
    }
    client.commands.set(data.name, { execute, onInit });
  }
}

await registerCommands();

for (const [name, command] of client.commands) {
  if (typeof command.onInit === 'function') {
    await command.onInit(client);
    console.log(`✅ Initialized command: ${name}`);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🔥 FlameKeeper is online as ${readyClient.user.tag}`);
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

client.login(process.env.DISCORD_TOKEN);
