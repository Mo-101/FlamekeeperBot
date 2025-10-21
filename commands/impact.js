import { ethers } from 'ethers';
import { FlameBornEngine, provider } from '../utils/celo.js';
import { createEventEmbed } from '../utils/embeds.js';

let liveStreamChannelId = null;
let listenerRegistered = false;

export const data = {
  name: 'impact',
  description: 'Stream live donation events from the FlameBornEngine on Celo',
};

function registerDonationListener(channel) {
  if (listenerRegistered) {
    return;
  }

  FlameBornEngine.on('DonationProcessed', (donor, amount, beneficiary) => {
    const formattedAmount = ethers.formatEther(amount);
    const description = `**Donor:** ${donor}\n**Beneficiary:** ${beneficiary}\n**Amount:** ${formattedAmount} CELO`;
    const embed = createEventEmbed('💧 Proof of Healing Recorded', description);
    channel
      .send({ embeds: [embed] })
      .catch((error) => console.error('Failed to send donation event', error));
  });

  listenerRegistered = true;
  liveStreamChannelId = channel.id;
}

async function fetchRecentDonations(limit = 3) {
  const filter = FlameBornEngine.filters.DonationProcessed();
  const latestBlock = await provider.getBlockNumber();
  const startBlock = Math.max(0, latestBlock - 5000);
  const events = await FlameBornEngine.queryFilter(filter, startBlock, latestBlock);
  return events.slice(-limit).reverse();
}

export async function execute(message) {
  await message.channel.send('💧 Listening for FlameBornEngine donations on Celo Alfajores...');

  if (listenerRegistered && liveStreamChannelId !== message.channel.id) {
    await message.channel.send('🔁 Live donation updates are already streaming in another channel.');
    return;
  }

  try {
    const recentEvents = await fetchRecentDonations();
    if (recentEvents.length === 0) {
      await message.channel.send('🕯️ The chain is quiet for now. New donations will appear here in real time.');
    } else {
      for (const event of recentEvents) {
        const { donor, amount, beneficiary } = event.args;
        const formattedAmount = ethers.formatEther(amount);
        const description = `**Donor:** ${donor}\n**Beneficiary:** ${beneficiary}\n**Amount:** ${formattedAmount} CELO`;
        const embed = createEventEmbed('💧 Proof of Healing Recorded', description);
        await message.channel.send({ embeds: [embed] });
      }
    }

    registerDonationListener(message.channel);
    await message.channel.send('🔥 Live donation stream activated.');
  } catch (error) {
    console.error('impact command failed', error);
    await message.channel.send('🔥 Unable to read donation events right now. Please try again later.');
  }
}
