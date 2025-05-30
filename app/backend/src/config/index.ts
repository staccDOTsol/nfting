import dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';

dotenv.config();

interface Config {
  server: {
    port: number;
    nodeEnv: string;
  };
  solana: {
    rpcUrl: string;
    network: string;
    programId: string;
    feeReceiver: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  ipfs: {
    gateway: string;
  };
  api: {
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  logging: {
    level: string;
  };
}

const loadConfig = (): Config => {
  return {
    server: {
      port: parseInt(process.env.PORT || '3001', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    solana: {
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      network: process.env.SOLANA_NETWORK || 'mainnet-beta',
      programId: process.env.PROGRAM_ID || '14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb',
      feeReceiver: process.env.FEE_RECEIVER || '89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    ipfs: {
      gateway: process.env.IPFS_GATEWAY || 'https://gateway.pinit.io/ipfs/',
    },
    api: {
      rateLimitWindowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '60000', 10),
      rateLimitMaxRequests: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
  };
};

export const config = loadConfig();
export default config; 