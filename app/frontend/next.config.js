/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['gateway.pinit.io', 'arweave.net', 'ipfs.io'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta',
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  },
}

module.exports = nextConfig 