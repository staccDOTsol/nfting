import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  TransactionInstruction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN, Wallet } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Load IDL (adjust path as needed)
const idl = require('../target/idl/nfting.json');

// Constants
const NFT_BEATER_PROGRAM_ID = new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");
const MENAGERIE_PROGRAM_ID = new PublicKey("F9SixdqdmEBP5kprp2gZPZNeMmfHJRCTMFjN22dx3akf");
const MERKLE_TREE_ADDRESS = new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
const BUBBLEGUM_PROGRAM_ID = new PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const FEE_RECEIVER = new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY");
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

// Mint Record interface
interface MintRecord {
  mintIndex: number | null;
  assetId: string;
  mintCount: number;
  rarityScore: number | null;
  minter: string;
  timestamp: number;
}

// Mint Pattern interface 
interface MintPattern {
  difference: number;
  occurrences: number;
  probability: number;
}

// Main class for NFT metadata indexing and rarity analysis
export class MenagerieIndexer {
  private connection: Connection;
  private wallet: Keypair;
  private program: Program;
  private metadataByIndex: Map<number, NFTMetadata> = new Map();
  private rarityScores: Map<number, number> = new Map();
  private mintRecords: MintRecord[] = [];
  private mintPatterns: MintPattern[] = [];
  
  constructor(connection: Connection, wallet: Keypair) {
    this.connection = connection;
    this.wallet = wallet;
    
    // Initialize the program
    const provider = new AnchorProvider(
      connection,
      new Wallet(wallet),
      { commitment: 'confirmed', skipPreflight: true }
    );
    
    // @ts-ignore
    this.program = new Program(idl, NFT_BEATER_PROGRAM_ID, provider);
    
    console.log("Menagerie Indexer initialized");
  }
  
  /**
   * Get the NFT Beater PDA for the merkle tree
   */
  async getNftBeaterPda(): Promise<PublicKey> {
    const [pda] = await PublicKey.findProgramAddress(
      [
        Buffer.from('nft-beater'),
        MERKLE_TREE_ADDRESS.toBuffer(),
      ],
      NFT_BEATER_PROGRAM_ID
    );
    return pda;
  }
  
  /**
   * Initialize the NFT Beater program state
   */
  async initialize(): Promise<void> {
    console.log('Initializing NFT Beater state...');
    
    try {
      const rarityThresholds = [50, 75, 90]; // Common, Rare, Legendary
      
      await this.program.methods
        .initialize(MERKLE_TREE_ADDRESS, Buffer.from(rarityThresholds))
        .accounts({
          state: await this.getNftBeaterPda(),
          merkleTree: MERKLE_TREE_ADDRESS,
          merkleTreeAccount: MERKLE_TREE_ADDRESS,
          authority: this.wallet.publicKey,
          feeReceiver: FEE_RECEIVER,
          systemProgram: SystemProgram.programId,
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
              
              // Extract rarity score from metadata
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
            }
          })
      );
    }
    
    await Promise.all(promises);
    console.log(`Indexed ${this.metadataByIndex.size} NFTs`);
  }
  
  /**
   * Update rarity data in the on-chain program state
   */
  async updateRarityData(): Promise<void> {
    console.log('Updating on-chain rarity data...');
    
    // Find the largest index in our rarity data
    const maxIndex = Math.max(...Array.from(this.rarityScores.keys()));
    
    // Create a rarity array with all indices from 0 to maxIndex
    const rarityArray = new Array(maxIndex + 1).fill(0);
    
    // Fill in the rarity scores we have
    this.rarityScores.forEach((score, index) => {
      rarityArray[index] = Math.floor(score);
    });
    
    // Split into chunks to avoid transaction size limits
    const chunkSize = 1000;
    for (let i = 0; i < rarityArray.length; i += chunkSize) {
      const chunk = rarityArray.slice(i, i + chunkSize);
      
      try {
        await this.program.methods
          .updateRarityData(new BN(i), Buffer.from(chunk))
          .accounts({
            state: await this.getNftBeaterPda(),
            authority: this.wallet.publicKey,
            feeReceiver: FEE_RECEIVER,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.wallet])
          .rpc();
        
        console.log(`Updated rarity data for indices ${i} to ${i + chunk.length - 1}`);
      } catch (error) {
        console.error(`Error updating rarity data for chunk starting at ${i}:`, error);
        throw error;
      }
      
      // Add delay between chunks
      if (i + chunkSize < rarityArray.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('Rarity data updated on-chain successfully');
  }
  
  /**
   * Analyze a mint transaction to determine which NFT was minted
   */
  async analyzeMintTransaction(
    transactionSignature: string,
    mintKeypair: PublicKey,
    expectedMintIndex?: number
  ): Promise<void> {
    console.log(`Analyzing transaction: ${transactionSignature}`);
    
    try {
      // Get the metadata account for this mint
      const [metadataAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );
      
      // Get the transaction sender
      const txInfo = await this.connection.getTransaction(transactionSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      if (!txInfo || !txInfo.meta) {
        throw new Error('Transaction not found or missing metadata');
      }
      
      const sender = txInfo.transaction.message.getAccountKeys()[0];
      
      // Create signature buffer
      const signatureBuffer = Buffer.from(transactionSignature, 'base64');
      
      // Call the analyze_mint_transaction instruction
      await this.program.methods
        .analyzeMintTransaction(
          [...signatureBuffer], // Convert to array for AnchorProgram
          expectedMintIndex ? new BN(expectedMintIndex) : null
        )
        .accounts({
          state: await this.getNftBeaterPda(),
          merkleTree: MERKLE_TREE_ADDRESS,
          treeConfig: await this.getTreeConfigPDA(),
          mintAccount: mintKeypair,
          metadataAccount: metadataAccount,
          transactionSender: sender, 
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        })
        .rpc();
      
      console.log('Mint transaction analysis complete');
    } catch (error) {
      console.error('Error analyzing mint transaction:', error);
      throw error;
    }
  }
  
  /**
   * Get mint statistics from the on-chain program state
   */
  async getMintStatistics(): Promise<void> {
    console.log('Fetching mint statistics...');
    
    try {
      await this.program.methods
        .getMintStatistics()
        .accounts({
          state: await this.getNftBeaterPda(),
        })
        .rpc();
      
      console.log('Mint statistics printed to program logs');
    } catch (error) {
      console.error('Error getting mint statistics:', error);
      throw error;
    }
  }
  
  /**
   * Get the tree config PDA
   */
  async getTreeConfigPDA(): Promise<PublicKey> {
    return (await PublicKey.findProgramAddress(
      [MERKLE_TREE_ADDRESS.toBuffer()],
      BUBBLEGUM_PROGRAM_ID
    ))[0];
  }
  
  /**
   * Validate a mint with minimum rarity threshold
   */
  async validateMint(minRarityPercentage: number, mintIndex?: number): Promise<boolean> {
    console.log(`Validating mint with minimum rarity: ${minRarityPercentage}%`);
    
    try {
      await this.program.methods
        .validateMint(
          mintIndex ? new BN(mintIndex) : null,
          minRarityPercentage
        )
        .accounts({
          state: await this.getNftBeaterPda(),
          merkleTree: MERKLE_TREE_ADDRESS,
          treeConfig: await this.getTreeConfigPDA(),
          minter: this.wallet.publicKey,
          feeReceiver: FEE_RECEIVER,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.wallet])
        .rpc();
      
      console.log('Mint validation successful!');
      return true;
    } catch (error: any) {
      if (error.message?.includes('RarityBelowThreshold')) {
        console.error('Mint validation failed: NFT does not meet minimum rarity threshold');
      } else {
        console.error('Error validating mint:', error);
      }
      return false;
    }
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
        }
      });
      
      console.log(`Loaded ${this.rarityScores.size} rarity scores from ${filePath}`);
    }
  }
}

// Main function to run the indexer
async function main() {
  // Use a high-performance RPC endpoint
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  // Load wallet from keypair file
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(
      path.resolve(process.env.KEYPAIR_PATH || '/Users/jarettdunn/ddgb.json'), 
      'utf-8'
    )))
  );
  
  const indexer = new MenagerieIndexer(connection, wallet);
  
  // Command-line arguments
  const command = process.argv[2] || 'help';
  
  switch (command) {
    case 'init':
      await indexer.initialize();
      break;
      
    case 'index':
      const startIndex = parseInt(process.argv[3] || '0');
      const count = parseInt(process.argv[4] || '100');
      await indexer.indexMetadataBatch(startIndex, count);
      
      // Save the data to a file
      indexer.saveRarityData('menagerie-rarity-data.json');
      break;
      
    case 'update':
      // Load existing data first
      indexer.loadRarityData('menagerie-rarity-data.json');
      // Update on-chain data
      await indexer.updateRarityData();
      break;
      
    case 'analyze':
      const txSignature = process.argv[3];
      const mintAddress = process.argv[4];
      const expectedIndex = process.argv[5] ? parseInt(process.argv[5]) : undefined;
      
      if (!txSignature || !mintAddress) {
        console.error('Usage: analyze <txSignature> <mintAddress> [expectedIndex]');
        process.exit(1);
      }
      
      await indexer.analyzeMintTransaction(
        txSignature,
        new PublicKey(mintAddress),
        expectedIndex
      );
      break;
      
    case 'stats':
      await indexer.getMintStatistics();
      break;
      
    case 'validate':
      const minRarity = parseInt(process.argv[3] || '50');
      const specificIndex = process.argv[4] ? parseInt(process.argv[4]) : undefined;
      
      const result = await indexer.validateMint(minRarity, specificIndex);
      console.log(`Validation result: ${result ? 'PASS' : 'FAIL'}`);
      break;
      
    case 'help':
    default:
      console.log(`
Usage: 
  init                         - Initialize the NFT Beater program state
  index <startIndex> <count>   - Index NFT metadata and save to a file
  update                       - Update on-chain rarity data
  analyze <tx> <mint> [index]  - Analyze a mint transaction
  stats                        - Get mint statistics
  validate <rarity> [index]    - Validate a mint against minimum rarity
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