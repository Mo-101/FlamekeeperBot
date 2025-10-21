import { registry } from '../utils/celo.js';
import { isAddress } from 'ethers';

export const data = {
  name: 'verify',
  description: 'Check if a wallet is a verified health actor on Celo',
};

export async function execute(message, args) {
  if (args.length < 1) {
    await message.reply('🕯️ Please provide a wallet address like `!verify 0x1234...`');
    return;
  }

  const address = args[0];
  if (!isAddress(address)) {
    await message.reply('⚠️ That does not look like a valid wallet address. Double-check and try again.');
    return;
  }

  try {
    const isVerified = await registry.isVerified(address);
    if (isVerified) {
      await message.reply(`✅ ${address} is recognized as a verified Health Actor. The Flame honors their service.`);
    } else {
      await message.reply(`❌ ${address} is not yet verified in the HealthActorRegistry.`);
    }
  } catch (error) {
    console.error('verify command failed', error);
    await message.reply('🔥 The chain is quiet right now. Please try again in a moment.');
  }
}
