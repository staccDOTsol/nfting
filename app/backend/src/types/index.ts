import { PublicKey } from '@solana/web3.js';

export interface NFTMetadata {
  index: number;
  name: string;
  symbol: string;
  uri: string;
  image?: string;
  description?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{
      uri: string;
      type: string;
    }>;
    category?: string;
  };
}

export interface RarityData {
  index: number;
  score: number;
  rank?: number;
  percentile?: number;
}

export interface CollectionInfo {
  merkleTree: PublicKey;
  name: string;
  symbol: string;
  totalSupply: number;
  mintedCount: number;
  ipfsHash: string;
  isInitialized: boolean;
  lastIndexed?: Date;
}

export interface MintRequest {
  walletAddress: string;
  collectionAddress: string;
  minRarityPercentage: number;
}

export interface MintResponse {
  success: boolean;
  transactionSignature?: string;
  nftIndex?: number;
  rarityScore?: number;
  error?: string;
}

export interface RarityCheckRequest {
  collectionAddress: string;
  indices?: number[];
  minRarity?: number;
}

export interface RarityCheckResponse {
  eligible: NFTWithRarity[];
  ineligible: NFTWithRarity[];
  stats: {
    totalChecked: number;
    eligibleCount: number;
    averageRarity: number;
  };
}

export interface NFTWithRarity extends NFTMetadata {
  rarity: RarityData;
}

export interface SyncStatus {
  collectionAddress: string;
  totalIndices: number;
  syncedIndices: number;
  lastSyncedAt?: Date;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface JobStatus {
  id: string;
  type: 'index' | 'sync' | 'mint';
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  data?: any;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
} 