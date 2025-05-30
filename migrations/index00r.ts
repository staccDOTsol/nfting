import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    Keypair,
    sendAndConfirmTransaction,
  } from '@solana/web3.js';
  import { Program, AnchorProvider, web3, BN, Wallet } from '@coral-xyz/anchor';
  import * as fs from 'fs';
  import * as path from 'path';
  import axios from 'axios';
  import * as idl from '../target/idl/nfting.json';
  import { 
    CandyMachine,
    CandyMachineConfigLineSettings,
    CandyMachineHiddenSettings 
  } from '@metaplex-foundation/js/dist/types/plugins/candyMachineModule/models/CandyMachine';
  import { Metaplex } from '@metaplex-foundation/js';
  
  // Constants for parallel processing
  const BATCH_SIZE = 256; // Number of concurrent requests
  const RATE_LIMIT_DELAY = 50; // ms between batches
  
  // NFT metadata structure
  interface NFTMetadata {
    name: string;
    symbol: string;
    description: string;
    seller_fee_basis_points: number;
    image: string;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  }
  
  interface MetadataFetchResult {
    index: number;
    metadata: NFTMetadata | null;
    error?: any;
  }
  
  // This class indexes a candy machine's NFTs and calculates rarity scores
  export class CandyMachineIndexer {
    private connection: Connection;
    private program: Program;
    private wallet: Keypair;
    private candyMachineId: PublicKey;
    private candyMachine?: CandyMachine;
    private metaplex: Metaplex;
    
    // Maps to store trait frequencies and rarity scores
    private traitFrequencies: Map<string, Map<string, number>> = new Map();
    private rarityScores: Map<number, number> = new Map();
    private metadataByIndex: Map<number, NFTMetadata> = new Map();
    
    // NFT count for percentage calculations
    private totalNFTs: number = 0;
    
    constructor(
      connection: Connection,
      wallet: Keypair,
      candyMachineId: string | PublicKey
    ) {
      this.connection = connection;
      this.wallet = wallet;
      this.candyMachineId = typeof candyMachineId === 'string' 
        ? new PublicKey(candyMachineId)
        : candyMachineId;
      
      // Create wallet adapter from keypair
      const walletAdapter = new Wallet(wallet);
      
      // Initialize the program
      const provider = new AnchorProvider(
        connection,
        walletAdapter,
        { commitment: 'confirmed' }
      );
      
      // Initialize Metaplex
      this.metaplex = new Metaplex(connection);
      
      // Initialize the NFT Beater program
      // @ts-ignore
      this.program = new Program(idl as any,new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb"), provider);
    }
    
    /**
     * Fetch candy machine data and config lines
     */
    async fetchCandyMachineData(): Promise<void> {
      console.log(`Fetching candy machine data for: ${this.candyMachineId.toString()}`);
      
      try {
        // Use Metaplex to fetch candy machine
        this.candyMachine = await this.metaplex
          .candyMachines()
          .findByAddress({ address: this.candyMachineId })
        
        console.log(`Items Available: ${this.candyMachine.itemsAvailable}`);
        console.log(`Items Minted: ${this.candyMachine.itemsMinted}`);
        this.totalNFTs = Number(this.candyMachine.itemsAvailable);
        
      } catch (error) {
        console.error('Error fetching candy machine:', error);
        throw new Error('Failed to fetch candy machine data');
      }
    }
    
    /**
     * Fetch metadata in parallel with rate limiting
     */
    private async fetchMetadataBatch(
      uris: { index: number; uri: string }[]
    ): Promise<MetadataFetchResult[]> {
      const promises = uris.map(async ({ index, uri }) => {
        try {
          const response = await axios.get(uri);
          return { index, metadata: response.data };
        } catch (error) {
          console.error(`Error fetching metadata for index ${index}:`, error);
          return { index, metadata: null, error };
        }
      });
  
      return Promise.all(promises);
    }
  
    /**
     * Process metadata in batches
     */
    private async processMetadataBatches(items: { uri: string }[]): Promise<void> {
      const total = items.length;
      const batches = Math.ceil(total / BATCH_SIZE);
      console.log(`Processing ${total} items in ${batches} batches of ${BATCH_SIZE}`);
  
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batchItems = items.slice(i, i + BATCH_SIZE).map((item, idx) => ({
          index: i + idx,
          uri: item.uri
        }));
  
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${batches}`);
        const results = await this.fetchMetadataBatch(batchItems);
  
        // Store successful results
        results.forEach(({ index, metadata }) => {
          if (metadata) {
            this.metadataByIndex.set(index, metadata);
          }
        });
  
        // Add delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < total) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        }
  
        // Log progress
        const progress = Math.min(100, Math.round((i + BATCH_SIZE) / total * 100));
        console.log(`Progress: ${progress}% (${this.metadataByIndex.size}/${total} items indexed)`);
      }
    }
    
    /**
     * Fetch and index metadata for all NFTs in the candy machine
     */
    async indexAllMetadata(): Promise<void> {
      if (!this.candyMachine) {
        await this.fetchCandyMachineData();
      }
      
      console.log('Indexing all metadata...');
      
      // Check if using hidden settings
      if (this.candyMachine?.itemSettings.type === 'hidden') {
        await this.indexHiddenCollection();
        return;
      }
      
      if (!this.candyMachine) {
        throw new Error('Candy machine not found');
      }
      
      // For non-hidden collections, fetch each config line
      const items = this.candyMachine.items;
      await this.processMetadataBatches(items);
      
      // Calculate trait frequencies and rarity scores
      this.calculateTraitFrequencies();
      this.calculateRarityScores();
    }
    
    /**
     * Index a hidden collection by parsing the pattern URI
     */
    private async indexHiddenCollection(): Promise<void> {
      if (!this.candyMachine || this.candyMachine.itemSettings.type !== 'hidden') {
        throw new Error('No hidden settings found');
      }
      
      const hiddenSettings = this.candyMachine.itemSettings as CandyMachineHiddenSettings;
      const baseUri = hiddenSettings.uri;
      console.log(`Hidden collection with base URI: ${baseUri}`);
      
      // Generate all URIs first
      const items = Array.from(
        { length: Number(this.candyMachine.itemsAvailable) },
        (_, i) => ({ uri: this.formatHiddenUri(baseUri, i) })
      );
      
      // Process in batches
      await this.processMetadataBatches(items);
      
      if (this.metadataByIndex.size === 0) {
        console.log('No revealed NFTs found for hidden collection');
        return;
      }
      
      // Calculate trait frequencies and rarity scores
      this.calculateTraitFrequencies();
      this.calculateRarityScores();
    }
    
    /**
     * Format URI for hidden settings using proper variables
     */
    private formatHiddenUri(baseUri: string, index: number): string {
      return baseUri
        .replace(/\$ID\$/g, index.toString())
        .replace(/\$ID\+1\$/g, (index + 1).toString());
    }
    
    /**
     * Calculate the frequency of each trait type and value
     */
    private calculateTraitFrequencies(): void {
      console.log('Calculating trait frequencies...');
      
      // Reset frequencies
      this.traitFrequencies.clear();
      
      // Count occurrences of each trait
      this.metadataByIndex.forEach((metadata) => {
        metadata.attributes.forEach((attribute) => {
          if (!this.traitFrequencies.has(attribute.trait_type)) {
            this.traitFrequencies.set(attribute.trait_type, new Map());
          }
          
          const traitValues = this.traitFrequencies.get(attribute.trait_type)!;
          traitValues.set(
            attribute.value,
            (traitValues.get(attribute.value) || 0) + 1
          );
        });
      });
    }
    
    /**
     * Calculate rarity scores for each NFT
     */
    private calculateRarityScores(): void {
      console.log('Calculating rarity scores...');
      
      // First pass - calculate raw rarity scores
      const rawScores = new Map<number, number>();
      this.metadataByIndex.forEach((metadata, index) => {
        let score = 0;
        
        metadata.attributes.forEach((attribute) => {
          const traitFreq = this.traitFrequencies.get(attribute.trait_type)!;
          const valueFreq = traitFreq.get(attribute.value)!;
          // Calculate rarity score as 1 / frequency
          score += 1 / (valueFreq / this.metadataByIndex.size);
        });
        
        rawScores.set(index, score);
      });
  
      // Find min and max scores for normalization
      const scores = Array.from(rawScores.values());
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const range = maxScore - minScore;
  
      // Second pass - normalize to 0-100 scale
      rawScores.forEach((score, index) => {
        // Normalize using min-max scaling to 0-100
        const normalizedScore = range === 0 ? 50 : // If all items have same rarity, assign 50
          Math.round(((score - minScore) / range) * 100);
        this.rarityScores.set(index, normalizedScore);
      });
  
      console.log(`Normalized ${this.rarityScores.size} rarity scores from ${minScore.toFixed(2)} to ${maxScore.toFixed(2)}`);
    }
    
    /**
     * Save rarity data to a file
     */
    saveRarityData(filePath: string): void {
      const data = {
        candyMachine: this.candyMachineId.toString(),
        totalNFTs: this.totalNFTs,
        rarityScores: Array.from(this.rarityScores.entries()).map(([index, score]) => ({
          index,
          score,
          metadata: this.metadataByIndex.get(index),
        })),
      };
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Rarity data saved to ${filePath}`);
    }
    
    /**
     * Initialize the NFT Beater program state for this candy machine
     */
    async initialize(): Promise<void> {
      console.log('Initializing NFT Beater state...');
      
      try {
        // Pass thresholds directly as a number array
        const rarity_thresholds = [50, 75, 90];
        
        await this.program.methods
          .initialize(this.candyMachineId,  Buffer.from(rarity_thresholds))
          .accounts({
            state: await this.getNftBeaterPda(),
            candyMachineId: this.candyMachineId,
            feeReceiver: new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
            authority: this.wallet.publicKey,
            systemProgram: web3.SystemProgram.programId,
          })
          .signers([this.wallet])
          .rpc();
        
        console.log('NFT Beater state initialized successfully');
      } catch (error: any) {
        // If account already initialized, we can proceed
        if (error?.message?.includes('already in use')) {
          console.log('NFT Beater state already initialized');
          return;
        }
        throw error;
      }
    }
  
    /**
     * Update rarity data on-chain
     */
    async updateOnChainRarityData(): Promise<void> {
      if (this.rarityScores.size === 0) {
        throw new Error('No rarity scores calculated');
      }
      
      console.log('Updating on-chain rarity data...');
      
      // Initialize if not already initialized
      await this.initialize();
      
      // Convert rarity scores to u8 array (0-100)
      const rarityData = Array.from(this.rarityScores.entries())
        .sort(([a], [b]) => a - b)
        .map(([_, score]) => Math.floor(score));
      
      // Update in smaller chunks to fit within state size limits
      const chunkSize = 50; // Smaller chunks to ensure we stay within limits
      for (let i = 0; i < rarityData.length; i += chunkSize) {
        const chunk = rarityData.slice(i, i + chunkSize);
        
        try {
          // No need to pad to 100 bytes anymore since we're using smaller chunks
          const buffer = Buffer.from(chunk);
          
          await this.program.methods
            .updateRarityData(new BN(i), buffer)
            .accounts({
              state: await this.getNftBeaterPda(),
              authority: this.wallet.publicKey,
              feeReceiver: new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
              systemProgram: web3.SystemProgram.programId,
            })
            .signers([this.wallet])
            .rpc();
          
          console.log(`Updated rarity data for indices ${i} to ${i + chunk.length - 1}`);
        } catch (error) {
          console.error(`Error updating rarity data for chunk ${i}:`, error);
          throw error;
        }
      }
      
      console.log('Rarity data updated on-chain successfully');
    }
    
    /**
     * Get the NFT Beater PDA for this candy machine
     */
    private async getNftBeaterPda(): Promise<PublicKey> {
      const [pda] = await PublicKey.findProgramAddress(
        [
          Buffer.from('nft-beater'),
          this.candyMachineId.toBuffer(),
        ],
        this.program.programId
      );
      return pda;
    }
  }