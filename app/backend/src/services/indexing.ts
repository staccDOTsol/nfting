import axios from 'axios';
import { PublicKey } from '@solana/web3.js';
import config from '../config';
import logger from '../utils/logger';
import cacheService from './cache';
import { NFTMetadata, RarityData, CollectionInfo } from '../types';

interface AttributeCount {
  [traitType: string]: {
    [value: string]: number;
  };
}

export class IndexingService {
  /**
   * Index a collection's metadata and calculate rarity scores
   */
  async indexCollection(
    collectionAddress: string,
    ipfsHash: string,
    totalSupply: number,
    batchSize: number = 50
  ): Promise<void> {
    logger.info(`Starting indexing for collection ${collectionAddress}`);
    
    const collectionInfo: CollectionInfo = {
      merkleTree: new PublicKey(collectionAddress),
      name: '',
      symbol: '',
      totalSupply,
      mintedCount: 0,
      ipfsHash,
      isInitialized: false,
      lastIndexed: new Date(),
    };
    
    // Save collection info
    await cacheService.setCollectionInfo(collectionAddress, collectionInfo);
    
    // Process in batches
    const totalBatches = Math.ceil(totalSupply / batchSize);
    const allMetadata: NFTMetadata[] = [];
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, totalSupply);
      
      logger.info(`Processing batch ${batch + 1}/${totalBatches} (indices ${startIdx}-${endIdx - 1})`);
      
      const batchMetadata = await this.fetchBatchMetadata(
        ipfsHash,
        startIdx,
        endIdx
      );
      
      allMetadata.push(...batchMetadata);
      
      // Cache batch metadata
      await cacheService.batchSetNFTMetadata(collectionAddress, batchMetadata);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Calculate rarity scores for all NFTs
    const rarityData = this.calculateRarityScores(allMetadata);
    
    // Save rarity data to cache
    await cacheService.batchSetRarityData(collectionAddress, rarityData);
    
    // Update collection info
    collectionInfo.isInitialized = true;
    collectionInfo.name = allMetadata[0]?.name?.split('#')[0]?.trim() || 'Unknown Collection';
    collectionInfo.symbol = allMetadata[0]?.symbol || 'NFT';
    await cacheService.setCollectionInfo(collectionAddress, collectionInfo);
    
    logger.info(`Completed indexing for collection ${collectionAddress}`);
  }

  /**
   * Fetch metadata for a batch of NFTs
   */
  private async fetchBatchMetadata(
    ipfsHash: string,
    startIdx: number,
    endIdx: number
  ): Promise<NFTMetadata[]> {
    const promises: Promise<NFTMetadata | null>[] = [];
    
    for (let i = startIdx; i < endIdx; i++) {
      promises.push(this.fetchSingleMetadata(ipfsHash, i));
    }
    
    const results = await Promise.allSettled(promises);
    const metadata: NFTMetadata[] = [];
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        metadata.push(result.value);
      } else {
        logger.error(`Failed to fetch metadata for index ${startIdx + i}`);
      }
    }
    
    return metadata;
  }

  /**
   * Fetch single NFT metadata from IPFS
   */
  private async fetchSingleMetadata(
    ipfsHash: string,
    index: number
  ): Promise<NFTMetadata | null> {
    try {
      const uri = `${config.ipfs.gateway}${ipfsHash}/${index}.json`;
      const response = await axios.get(uri, {
        timeout: 10000,
        validateStatus: (status) => status === 200,
      });
      
      const data = response.data;
      
      return {
        index,
        name: data.name || `NFT #${index}`,
        symbol: data.symbol || 'NFT',
        uri,
        image: data.image,
        description: data.description,
        attributes: data.attributes || [],
        properties: data.properties,
      };
    } catch (error) {
      logger.error(`Error fetching metadata for index ${index}:`, error);
      return null;
    }
  }

  /**
   * Calculate rarity scores based on attribute frequency
   */
  private calculateRarityScores(metadata: NFTMetadata[]): RarityData[] {
    const totalNFTs = metadata.length;
    const attributeCounts: AttributeCount = {};
    
    // Count attribute occurrences
    for (const nft of metadata) {
      if (nft.attributes) {
        for (const attr of nft.attributes) {
          const traitType = attr.trait_type;
          const value = String(attr.value);
          
          if (!attributeCounts[traitType]) {
            attributeCounts[traitType] = {};
          }
          
          attributeCounts[traitType][value] = 
            (attributeCounts[traitType][value] || 0) + 1;
        }
      }
    }
    
    // Calculate rarity scores
    const rarityScores: { index: number; score: number }[] = [];
    
    for (const nft of metadata) {
      let totalRarityScore = 0;
      let attributeCount = 0;
      
      if (nft.attributes) {
        for (const attr of nft.attributes) {
          const traitType = attr.trait_type;
          const value = String(attr.value);
          
          const occurrences = attributeCounts[traitType]?.[value] || 0;
          const frequency = occurrences / totalNFTs;
          
          // Rarity score is inverse of frequency (1 - frequency) * 100
          const rarityScore = (1 - frequency) * 100;
          totalRarityScore += rarityScore;
          attributeCount++;
        }
      }
      
      // Average rarity score across all attributes
      const averageRarity = attributeCount > 0 
        ? totalRarityScore / attributeCount 
        : 0;
      
      rarityScores.push({
        index: nft.index,
        score: Math.round(averageRarity),
      });
    }
    
    // Sort by score to calculate ranks
    rarityScores.sort((a, b) => b.score - a.score);
    
    // Assign ranks and percentiles
    const rarityData: RarityData[] = rarityScores.map((item, idx) => ({
      index: item.index,
      score: item.score,
      rank: idx + 1,
      percentile: Math.round(((totalNFTs - idx) / totalNFTs) * 100),
    }));
    
    // Sort back by index for consistency
    rarityData.sort((a, b) => a.index - b.index);
    
    return rarityData;
  }

  /**
   * Re-index a specific set of NFTs
   */
  async reindexNFTs(
    collectionAddress: string,
    indices: number[]
  ): Promise<void> {
    const collectionInfo = await cacheService.getCollectionInfo(collectionAddress);
    if (!collectionInfo) {
      throw new Error('Collection not found');
    }
    
    const metadata: NFTMetadata[] = [];
    
    for (const index of indices) {
      const nft = await this.fetchSingleMetadata(collectionInfo.ipfsHash, index);
      if (nft) {
        metadata.push(nft);
        await cacheService.setNFTMetadata(collectionAddress, index, nft);
      }
    }
    
    logger.info(`Re-indexed ${metadata.length} NFTs for collection ${collectionAddress}`);
  }

  /**
   * Get indexing progress for a collection
   */
  async getIndexingProgress(collectionAddress: string): Promise<{
    totalSupply: number;
    indexed: number;
    percentage: number;
  }> {
    const collectionInfo = await cacheService.getCollectionInfo(collectionAddress);
    if (!collectionInfo) {
      return { totalSupply: 0, indexed: 0, percentage: 0 };
    }
    
    const stats = await cacheService.getCacheStats();
    
    // This is a rough estimate based on cache keys
    const indexed = Math.min(stats.nfts, collectionInfo.totalSupply);
    const percentage = Math.round((indexed / collectionInfo.totalSupply) * 100);
    
    return {
      totalSupply: collectionInfo.totalSupply,
      indexed,
      percentage,
    };
  }
}

export const indexingService = new IndexingService();
export default indexingService; 