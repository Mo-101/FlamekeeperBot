import { isAddress } from 'ethers';
import { HealthIDNFT } from './utils/celo.js';
import { createEventEmbed } from './utils/embeds.js';

export const data = {
  name: 'verify',
  description: 'Verify whether a wallet holds a FlameBorn HealthID NFT on Celo',
};

export async function execute(message, args) {
  const wallet = args[0];
  if (!wallet) {
    await message.reply('Usage: `!verify <wallet>`');
    return;
  }

  if (!isAddress(wallet)) {
    await message.reply('⚠️ That does not look like a valid wallet address.');
    return;
  }

  try {
    const balance = await HealthIDNFT.balanceOf(wallet);
    const verified = balance > 0n;
    const description = verified
      ? `✅ **${wallet}** holds a verified HealthID soulbound NFT. The village recognizes this healer.`
      : `❌ **${wallet}** has not yet received a HealthID NFT. Invite them to complete verification.`;
    const embed = createEventEmbed('🩺 Health ID Verification', description, verified ? '#00FF88' : '#FF4500');
    await message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('verify command failed', error);
    await message.reply('🔥 Unable to reach the chain right now. Please try again soon.');
  }
}
