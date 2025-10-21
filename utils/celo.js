import { ethers } from 'ethers';
import { config } from 'dotenv';

config();

const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC);

const healthActorAbi = [
  'function isVerified(address actor) view returns (bool)'
];

const donationAbi = [
  'event DonationProcessed(address indexed donor, uint256 amount, address indexed beneficiary)'
];

const registry = new ethers.Contract(
  process.env.REGISTRY_CONTRACT,
  healthActorAbi,
  provider
);

const donationRouter = new ethers.Contract(
  process.env.DONATION_CONTRACT,
  donationAbi,
  provider
);

export { provider, registry, donationRouter };
