import { EmbedBuilder } from 'discord.js';

export function createEventEmbed(title, description, color = '#FF6B00') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'FlameKeeper · FlameBorn DAO on Celo' })
    .setTimestamp();
}
