import { createEventEmbed } from '../utils/embeds.js';

export const data = {
  name: 'assignrole',
  description: 'Assign a Discord role after on-chain verification (placeholder implementation)',
};

export async function execute(message) {
  const embed = createEventEmbed(
    '🛡️ Role Sync Placeholder',
    'Codex will use this command to sync HealthID holders into Discord roles. Configure role IDs and permissions in your deployment before enabling it for Guardians.'
  );
  await message.channel.send({ embeds: [embed] });
}
