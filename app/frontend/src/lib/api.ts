import axios from 'axios'
import { PublicKey, Transaction } from '@solana/web3.js'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface CollectionInfo {
  merkleTree: string
  name: string
  symbol: string
  totalSupply: number
  mintedCount: number
  ipfsHash: string
  isInitialized: boolean
  lastIndexed?: string
  isOnChainInitialized?: boolean
  indexingProgress?: {
    totalSupply: number
    indexed: number
    percentage: number
  }
}

export interface NFTWithRarity {
  index: number
  name: string
  symbol: string
  uri: string
  image?: string
  description?: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
  rarity: {
    index: number
    score: number
    rank?: number
    percentile?: number
  }
}

export interface RarityCheckResponse {
  eligible: NFTWithRarity[]
  ineligible: NFTWithRarity[]
  stats: {
    totalChecked: number
    eligibleCount: number
    averageRarity: number
  }
}

export interface RarityDistribution {
  total: number
  distribution: {
    [range: string]: {
      count: number
      percentage: number
    }
  }
  averageRarity: number
  minRarity: number
  maxRarity: number
}

// Collection APIs
export const collectionApi = {
  getInfo: async (address: string): Promise<CollectionInfo> => {
    const { data } = await api.get(`/api/collections/${address}`)
    return data
  },

  getInitializeTransaction: async (
    walletAddress: string,
    collectionAddress: string,
    rarityThresholds: number[] = [50, 75, 90]
  ): Promise<{ transaction: string; message: string }> => {
    const { data } = await api.post('/api/collections/initialize-transaction', {
      walletAddress,
      collectionAddress,
      rarityThresholds,
    })
    return data
  },

  indexCollection: async (
    collectionAddress: string,
    ipfsHash: string,
    totalSupply: number
  ): Promise<{ message: string; estimatedTime: string }> => {
    const { data } = await api.post('/api/collections/index', {
      collectionAddress,
      ipfsHash,
      totalSupply,
    })
    return data
  },

  getIndexingProgress: async (address: string) => {
    const { data } = await api.get(`/api/collections/${address}/indexing-progress`)
    return data
  },
}

// Rarity APIs
export const rarityApi = {
  checkRarity: async (
    collectionAddress: string,
    indices?: number[],
    minRarity: number = 0
  ): Promise<RarityCheckResponse> => {
    const { data } = await api.post('/api/rarity/check', {
      collectionAddress,
      indices,
      minRarity,
    })
    return data
  },

  getSyncTransaction: async (
    walletAddress: string,
    collectionAddress: string,
    batchSize: number = 100
  ): Promise<{
    transaction: string
    batches: number
    totalIndices: number
    estimatedFee: number
    message: string
  }> => {
    const { data } = await api.post('/api/rarity/sync-transaction', {
      walletAddress,
      collectionAddress,
      batchSize,
    })
    return data
  },

  getDistribution: async (collectionAddress: string): Promise<RarityDistribution> => {
    const { data } = await api.get(`/api/rarity/${collectionAddress}/distribution`)
    return data
  },
}

// Stats APIs
export const statsApi = {
  getCacheStats: async () => {
    const { data } = await api.get('/api/stats/cache')
    return data
  },
}

// Helper to deserialize transaction from base64
export const deserializeTransaction = (base64: string): Transaction => {
  const buffer = Buffer.from(base64, 'base64')
  return Transaction.from(buffer)
} 