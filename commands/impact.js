import { donationRouter } from '../utils/celo.js';
import { createImpactEmbed } from '../utils/embeds.js';

let liveUpdatesChannelId = null;
let liveUpdatesRegistered = false;

export const data = {
  name: 'impact',
  description: 'Share the latest proof-of-impact donations flowing through FlameBorn',
};

async function ensureLiveUpdates(channel) {
  if (liveUpdatesRegistered) {
    if (liveUpdatesChannelId !== channel.id) {
      await channel.send('🔁 Live donation updates are already streaming in another channel. Ask a Guardian to move them if needed.');
    }
    return;
  }

  donationRouter.on('DonationProcessed', (donor, amount, beneficiary, event) => {
    const embed = createImpactEmbed(donor, amount, beneficiary, event?.blockNumber);
    channel.send({ embeds: [embed] }).catch((error) => {
      console.error('Failed to send live donation update', error);
    });
  });

  liveUpdatesChannelId = channel.id;
  liveUpdatesRegistered = true;
  await channel.send('💧 Live donation stream ignited — every new act of care will appear here.');
}

async function fetchLatestDonations(limit = 3) {
  const filter = donationRouter.filters.DonationProcessed();
  const latestEvents = await donationRouter.queryFilter(filter, -5000);
  if (!latestEvents.length) return [];
  return latestEvents.slice(-limit).reverse();
}

export async function execute(message) {
  await message.channel.send('🌍 Listening to the ledger. Gathering the latest ripples of impact...');

  try {
    const events = await fetchLatestDonations();
    if (!events.length) {
      await message.channel.send('🕯️ No recent donations found on the chain. The next spark will light this channel.');
    } else {
      for (const event of events) {
        const { donor, amount, beneficiary } = event.args;
        const embed = createImpactEmbed(donor, amount, beneficiary, event.blockNumber);
        await message.channel.send({ embeds: [embed] });
      }
    }

    await ensureLiveUpdates(message.channel);
  } catch (error) {
    console.error('impact command failed', error);
    await message.channel.send('🔥 The ledger is veiled right now. Please try again soon.');
  }
}
