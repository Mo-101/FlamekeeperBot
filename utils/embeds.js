import { EmbedBuilder } from 'discord.js';
import { formatEther } from 'ethers';

export function createImpactEmbed(donor, amount, beneficiary, blockNumber) {
  const formattedAmount = typeof amount === 'bigint' ? formatEther(amount) : amount;

  const embed = new EmbedBuilder()
    .setColor('#FF4500')
    .setTitle('💧 Proof of Healing Recorded')
    .setDescription(`**Amount:** ${formattedAmount} cUSD\n**Donor:** ${donor}\n**Beneficiary:** ${beneficiary}`)
    .setFooter({ text: 'FlameBorn DAO — Keeping the Flame of Transparency Alive' })
    .setTimestamp();

  if (blockNumber) {
    embed.addFields({ name: 'Block', value: `#${blockNumber}`, inline: true });
  }

  return embed;
}
