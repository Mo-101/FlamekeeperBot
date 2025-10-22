import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { createHttp } from "./http.js";
import {
  handleVerifyCommand,
  handleImpactCommand,
  handleLinkWalletCommand,
  handleAssignRoleCommand,
} from "./commands/index.js";
import {
  postDonation,
  runSyncStructure,
  setupCeloListeners,
} from "./utils/celo.js";

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');


const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const DONATIONS_CHANNEL_ID = process.env.DONATIONS_CHANNEL_ID;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const GUARDIAN_ROLE_NAME = process.env.GUARDIAN_ROLE_NAME || "Guardian";
const CORE_TEAM_ROLE_NAME = process.env.CORE_TEAM_ROLE_NAME || "CoreTeam";
const PORT = process.env.PORT;

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

  discordClient.once('ready', () => {
      console.log('FlameKeeper Bot is online and ready!');
  });

  discordClient.on('messageCreate', message => {
      if (message.content === '!ping') {
          message.channel.send('Pong!');
      }
  });

  // Setup Celo event listeners
  setupCeloListeners(discordClient, DONATIONS_CHANNEL_ID);

  // Start HTTP server if PORT is configured
  if (PORT) {
    const app = createHttp({
      discordClient,
      postDonation,
      runSyncStructure: async ({ dry }) => {
        // This is a placeholder for the actual structure sync logic
        // In a real scenario, this would interact with Discord API to
        // ensure roles, channels, etc., match a desired structure.
        console.log(`Running structure sync (dry run: ${dry})`);
        const guild = await discordClient.guilds.fetch(GUILD_ID);
        const roles = await guild.roles.fetch();
        const channels = await guild.channels.fetch();

        const result = {
          roles: roles.map((r) => ({ id: r.id, name: r.name })),
          channels: channels.map((c) => ({ id: c.id, name: c.name })),
        };
        return result;
      },
    });
    app.listen(PORT, () => {
      console.log(`HTTP server listening on port ${PORT}`);
    });
  }
});

discordClient.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const args = message.content.split(/\s+/);
  const command = args[0].toLowerCase();

  switch (command) {
    case "!verify":
      await handleVerifyCommand(message, args);
      break;
    case "!impact":
      await handleImpactCommand(message);
      break;
    case "!linkwallet":
      await handleLinkWalletCommand(message, args);
      break;
    case "!assignrole":
      await handleAssignRoleCommand(message, args);
      break;
    default:
      // Optionally handle unknown commands or do nothing
      break;
  }
});

discordClient.login(DISCORD_TOKEN);