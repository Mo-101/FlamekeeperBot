import { createEventEmbed } from './utils/embeds.js';

export const data = {
  name: 'linkwallet',
  description: 'Link a Discord member to their Celo wallet (placeholder implementation)',
};

export async function execute(message, args) {
  const wallet = args[0];
  if (!wallet) {
    await message.reply('Usage: `!linkwallet <wallet>`');
    return;
  }

  const embed = createEventEmbed(
    '🔗 Wallet Linking Pending',
    'This scaffold reserves the `!linkwallet` command for the Codex wallet registry integration. Plug in Supabase or your preferred backend to persist wallet relationships.'
  );
  await message.channel.send({ embeds: [embed] });
}
