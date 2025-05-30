import { createClient, RedisClientType } from 'redis';
import config from '../config';
import logger from '../utils/logger';
import { NFTMetadata, RarityData, CollectionInfo } from '../types';

class CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
      this.isConnected = true;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // Collection info methods
  async setCollectionInfo(address: string, info: CollectionInfo): Promise<void> {
    const key = `collection:${address}`;
    await this.client.set(key, JSON.stringify(info));
  }

  async getCollectionInfo(address: string): Promise<CollectionInfo | null> {
    const key = `collection:${address}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  // NFT metadata methods
  async setNFTMetadata(collectionAddress: string, index: number, metadata: NFTMetadata): Promise<void> {
    const key = `nft:${collectionAddress}:${index}`;
    await this.client.set(key, JSON.stringify(metadata), {
      EX: 86400 * 7, // 7 days TTL
    });
  }

  async getNFTMetadata(collectionAddress: string, index: number): Promise<NFTMetadata | null> {
    const key = `nft:${collectionAddress}:${index}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async batchSetNFTMetadata(collectionAddress: string, metadataArray: NFTMetadata[]): Promise<void> {
    const pipeline = this.client.multi();
    
    for (const metadata of metadataArray) {
      const key = `nft:${collectionAddress}:${metadata.index}`;
      pipeline.set(key, JSON.stringify(metadata), {
        EX: 86400 * 7, // 7 days TTL
      });
    }
    
    await pipeline.exec();
  }

  // Rarity data methods
  async setRarityData(collectionAddress: string, index: number, rarity: RarityData): Promise<void> {
    const key = `rarity:${collectionAddress}:${index}`;
    await this.client.set(key, JSON.stringify(rarity));
  }

  async getRarityData(collectionAddress: string, index: number): Promise<RarityData | null> {
    const key = `rarity:${collectionAddress}:${index}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async batchSetRarityData(collectionAddress: string, rarityArray: RarityData[]): Promise<void> {
    const pipeline = this.client.multi();
    
    for (const rarity of rarityArray) {
      const key = `rarity:${collectionAddress}:${rarity.index}`;
      pipeline.set(key, JSON.stringify(rarity));
    }
    
    await pipeline.exec();
  }

  async getRarityMap(collectionAddress: string): Promise<number[]> {
    const pattern = `rarity:${collectionAddress}:*`;
    const keys = await this.client.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    const values = await this.client.mGet(keys);
    const rarityMap: number[] = [];

    for (let i = 0; i < values.length; i++) {
      if (values[i]) {
        const rarity: RarityData = JSON.parse(values[i]);
        rarityMap[rarity.index] = rarity.score;
      }
    }

    return rarityMap;
  }

  // Search methods
  async searchByRarity(
    collectionAddress: string, 
    minRarity: number, 
    maxRarity: number = 100,
    limit: number = 100
  ): Promise<RarityData[]> {
    const pattern = `rarity:${collectionAddress}:*`;
    const keys = await this.client.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    const values = await this.client.mGet(keys);
    const results: RarityData[] = [];

    for (let i = 0; i < values.length && results.length < limit; i++) {
      if (values[i]) {
        const rarity: RarityData = JSON.parse(values[i]);
        if (rarity.score >= minRarity && rarity.score <= maxRarity) {
          results.push(rarity);
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  // Cache invalidation
  async invalidateCollection(collectionAddress: string): Promise<void> {
    const patterns = [
      `collection:${collectionAddress}`,
      `nft:${collectionAddress}:*`,
      `rarity:${collectionAddress}:*`,
    ];

    for (const pattern of patterns) {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    }
  }

  // Utility methods
  async getCacheStats(): Promise<{
    collections: number;
    nfts: number;
    rarities: number;
  }> {
    const [collections, nfts, rarities] = await Promise.all([
      this.client.keys('collection:*'),
      this.client.keys('nft:*'),
      this.client.keys('rarity:*'),
    ]);

    return {
      collections: collections.length,
      nfts: nfts.length,
      rarities: rarities.length,
    };
  }
}

export const cacheService = new CacheService();
export default cacheService; 