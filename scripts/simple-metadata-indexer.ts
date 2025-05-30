import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Constants
const IPFS_METADATA_BASE_URI = "https://gateway.pinit.io/ipfs/Qmd2mt5hpF9d9QMDhpX9SecoPsvdpqcGVnP7ETfxB6hrr3";

// NFT Metadata interface
interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  seller_fee_basis_points: number;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  genetic_data?: {
    genome: string;
    generation: number;
    rarity: number;
  };
}

// Main class for NFT metadata indexing and rarity analysis
export class SimpleMetadataIndexer {
  private connection: Connection;
  private metadataByIndex: Map<number, NFTMetadata> = new Map();
  private rarityScores: Map<number, number> = new Map();
  private attributeFrequencies: Map<string, Map<string, number>> = new Map();
  private totalIndexed: number = 0;
  
  constructor(connection: Connection) {
    this.connection = connection;
    console.log("Simple Metadata Indexer initialized");
  }
  
  /**
   * Fetch a single NFT's metadata from IPFS
   */
  async fetchNFTMetadata(index: number): Promise<NFTMetadata | null> {
    try {
      const uri = `${IPFS_METADATA_BASE_URI}/${index}.json`;
      console.log(`Fetching metadata from ${uri}`);
      
      const response = await axios.get(uri);
      return response.data as NFTMetadata;
    } catch (error) {
      console.error(`Error fetching metadata for NFT #${index}:`, error);
      return null;
    }
  }
  
  /**
   * Index a batch of NFT metadata
   */
  async indexMetadataBatch(startIndex: number, count: number): Promise<void> {
    console.log(`Indexing batch: ${startIndex} to ${startIndex + count - 1}`);
    
    const promises = [];
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      promises.push(
        this.fetchNFTMetadata(index)
          .then(metadata => {
            if (metadata) {
              this.metadataByIndex.set(index, metadata);
              this.totalIndexed++;
              
              // Extract rarity score from metadata if present
              if (metadata.genetic_data?.rarity !== undefined) {
                this.rarityScores.set(index, metadata.genetic_data.rarity);
              } else {
                // Look for rarity in attributes
                const rarityAttribute = metadata.attributes.find(
                  attr => attr.trait_type === 'Rarity Score' || attr.trait_type === 'Rarity'
                );
                
                if (rarityAttribute && typeof rarityAttribute.value === 'number') {
                  this.rarityScores.set(index, rarityAttribute.value);
                }
              }
              
              // Track attribute frequencies for statistical rarity calculation
              for (const attr of metadata.attributes) {
                if (!this.attributeFrequencies.has(attr.trait_type)) {
                  this.attributeFrequencies.set(attr.trait_type, new Map());
                }
                
                const valueMap = this.attributeFrequencies.get(attr.trait_type)!;
                const valueStr = String(attr.value);
                
                valueMap.set(valueStr, (valueMap.get(valueStr) || 0) + 1);
              }
            }
          })
      );
    }
    
    await Promise.all(promises);
    console.log(`Indexed ${this.totalIndexed} NFTs`);
    
    // Calculate statistical rarity scores
    this.calculateRarityScores();
  }
  
  /**
   * Index all NFTs up to a certain count
   */
  async indexAllMetadata(totalCount: number, batchSize: number = 50): Promise<void> {
    console.log(`Indexing all metadata up to ${totalCount} NFTs`);
    
    for (let i = 0; i < totalCount; i += batchSize) {
      const count = Math.min(batchSize, totalCount - i);
      await this.indexMetadataBatch(i, count);
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < totalCount) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Successfully indexed and analyzed ${this.totalIndexed} NFTs.`);
  }
  
  /**
   * Calculate statistical rarity scores based on attribute frequencies
   */
  private calculateRarityScores(): void {
    console.log("Calculating statistical rarity scores...");
    
    // Only proceed if we have indexed some NFTs
    if (this.totalIndexed === 0) {
      console.warn("No NFTs indexed yet, cannot calculate rarity scores");
      return;
    }
    
    // For each NFT, calculate its rarity score based on attribute frequencies
    for (const [index, metadata] of this.metadataByIndex.entries()) {
      let rarityScore = 0;
      
      // Calculate rarity score as sum of 1/frequency for each attribute
      for (const attr of metadata.attributes) {
        const traitType = attr.trait_type;
        const traitValue = String(attr.value);
        
        if (this.attributeFrequencies.has(traitType)) {
          const valueMap = this.attributeFrequencies.get(traitType)!;
          const frequency = valueMap.get(traitValue) || 1;
          const traitRarity = 1 / (frequency / this.totalIndexed);
          
          rarityScore += traitRarity;
        }
      }
      
      // Normalize rarity score to 0-100
      if (!this.rarityScores.has(index)) {
        this.rarityScores.set(index, rarityScore);
      }
    }
    
    // Normalize the scores to a 0-100 scale
    this.normalizeRarityScores();
    
    console.log(`Calculated rarity scores for ${this.rarityScores.size} NFTs`);
  }
  
  /**
   * Normalize rarity scores to a 0-100 scale
   */
  private normalizeRarityScores(): void {
    const scores = Array.from(this.rarityScores.values());
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;
    
    // Normalize each score
    for (const [index, score] of this.rarityScores.entries()) {
      const normalizedScore = range === 0 ? 50 : 
        Math.round(((score - minScore) / range) * 100);
      this.rarityScores.set(index, normalizedScore);
    }
    
    console.log(`Normalized ${this.rarityScores.size} rarity scores from 0 to 100`);
  }
  
  /**
   * Get rarity score for a specific NFT
   */
  getRarityScore(index: number): number {
    const score = this.rarityScores.get(index);
    if (score === undefined) {
      console.warn(`No rarity score found for index ${index}`);
      return 0;
    }
    return score;
  }
  
  /**
   * Get metadata for a specific NFT
   */
  getMetadata(index: number): NFTMetadata | undefined {
    return this.metadataByIndex.get(index);
  }
  
  /**
   * Get top N rarest NFTs
   */
  getTopRarestNFTs(count: number = 10): Array<{index: number, score: number, metadata: NFTMetadata}> {
    const entries = Array.from(this.rarityScores.entries())
      .map(([index, score]) => ({
        index,
        score,
        metadata: this.metadataByIndex.get(index)!
      }))
      .filter(entry => entry.metadata !== undefined)
      .sort((a, b) => b.score - a.score);
    
    return entries.slice(0, count);
  }
  
  /**
   * Get rarity tier distribution
   */
  getRarityTierDistribution(): Record<string, number> {
    const tiers = {
      'Common (0-50)': 0,
      'Uncommon (51-70)': 0,
      'Rare (71-85)': 0,
      'Epic (86-95)': 0,
      'Legendary (96-100)': 0,
    };
    
    for (const score of this.rarityScores.values()) {
      if (score <= 50) tiers['Common (0-50)']++;
      else if (score <= 70) tiers['Uncommon (51-70)']++;
      else if (score <= 85) tiers['Rare (71-85)']++;
      else if (score <= 95) tiers['Epic (86-95)']++;
      else tiers['Legendary (96-100)']++;
    }
    
    return tiers;
  }
  
  /**
   * Save rarity data to a JSON file
   */
  saveRarityData(filePath: string): void {
    const data = {
      totalNFTs: this.metadataByIndex.size,
      rarityScores: Array.from(this.rarityScores.entries()).map(([index, score]) => ({
        index,
        score,
        metadata: this.metadataByIndex.get(index),
      })),
      tierDistribution: this.getRarityTierDistribution(),
      topRarest: this.getTopRarestNFTs(20),
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Rarity data saved to ${filePath}`);
  }
  
  /**
   * Load rarity data from a JSON file
   */
  loadRarityData(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return;
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (data.rarityScores) {
      data.rarityScores.forEach((item: any) => {
        if (item.index !== undefined && item.score !== undefined) {
          this.rarityScores.set(item.index, item.score);
        }
        
        if (item.metadata) {
          this.metadataByIndex.set(item.index, item.metadata);
          this.totalIndexed++;
        }
      });
      
      console.log(`Loaded ${this.rarityScores.size} rarity scores from ${filePath}`);
    }
  }
  
  /**
   * Print rarity summary
   */
  printRaritySummary(): void {
    console.log("\n=== Rarity Summary ===");
    console.log(`Total NFTs indexed: ${this.totalIndexed}`);
    console.log(`Total with rarity scores: ${this.rarityScores.size}`);
    
    // Print tier distribution
    const tiers = this.getRarityTierDistribution();
    console.log("\nRarity Tier Distribution:");
    for (const [tier, count] of Object.entries(tiers)) {
      const percentage = ((count / this.rarityScores.size) * 100).toFixed(2);
      console.log(`${tier}: ${count} NFTs (${percentage}%)`);
    }
    
    // Print top 10 rarest NFTs
    const topRarest = this.getTopRarestNFTs(10);
    console.log("\nTop 10 Rarest NFTs:");
    topRarest.forEach((nft, i) => {
      console.log(`${i + 1}. NFT #${nft.index} - Score: ${nft.score} - Name: ${nft.metadata.name}`);
    });
    
    console.log("\n=== End of Summary ===");
  }
}

// Main function to run the indexer
async function main() {
  // Use a high-performance RPC endpoint
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  const indexer = new SimpleMetadataIndexer(connection);
  
  // Command-line arguments
  const command = process.argv[2] || 'help';
  
  switch (command) {
    case 'index':
      const startIndex = parseInt(process.argv[3] || '0');
      const count = parseInt(process.argv[4] || '100');
      await indexer.indexMetadataBatch(startIndex, count);
      
      // Save the data to a file
      indexer.saveRarityData('menagerie-rarity-data.json');
      
      // Print summary
      indexer.printRaritySummary();
      break;
      
    case 'all':
      const totalCount = parseInt(process.argv[3] || '1000');
      const batchSize = parseInt(process.argv[4] || '50');
      await indexer.indexAllMetadata(totalCount, batchSize);
      
      // Save the data to a file
      indexer.saveRarityData('menagerie-rarity-data.json');
      
      // Print summary
      indexer.printRaritySummary();
      break;
      
    case 'load':
      // Load existing data
      indexer.loadRarityData('menagerie-rarity-data.json');
      
      // Print summary
      indexer.printRaritySummary();
      break;
      
    case 'help':
    default:
      console.log(`
Usage: 
  index <startIndex> <count>   - Index a batch of NFT metadata and save to a file
  all <totalCount> <batchSize> - Index all NFTs up to totalCount
  load                         - Load previously saved rarity data
  help                         - Show this help message
      `);
      break;
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
} 