import { ethers } from 'ethers';
import { config } from 'dotenv';

config();

const { CELO_RPC } = process.env;
if (!CELO_RPC) {
  throw new Error('Missing CELO_RPC environment variable');
}

const provider = new ethers.JsonRpcProvider(CELO_RPC);

const tokenAddress = process.env.FLB_TOKEN_CONTRACT;
const engineAddress = process.env.FLB_ENGINE_CONTRACT;
const healthIdAddress = process.env.FLB_HEALTHIDNFT_CONTRACT;

const requiredAddresses = [
  ['FLB_TOKEN_CONTRACT', tokenAddress],
  ['FLB_ENGINE_CONTRACT', engineAddress],
  ['FLB_HEALTHIDNFT_CONTRACT', healthIdAddress],
];

for (const [label, value] of requiredAddresses) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${label}`);
  }
}

const chainId = Number(process.env.CHAIN_ID ?? 44787);

const tokenAbi = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const engineAbi = [
  'event DonationProcessed(address indexed donor, uint256 amount, address indexed beneficiary)',
  'event RewardIssued(address indexed to, uint256 amount, string reason)',
  'function getRewardBalance(address user) view returns (uint256)',
];

const healthIdAbi = [
  'function balanceOf(address) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event HealthActorVerified(address indexed actor)',
];

const FLBToken = new ethers.Contract(tokenAddress, tokenAbi, provider);
const FlameBornEngine = new ethers.Contract(engineAddress, engineAbi, provider);
const HealthIDNFT = new ethers.Contract(healthIdAddress, healthIdAbi, provider);

export { provider, chainId, FLBToken, FlameBornEngine, HealthIDNFT };
