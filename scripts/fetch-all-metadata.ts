import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { PromisePool } from '@supercharge/promise-pool';
import { Program, Wallet } from '@coral-xyz/anchor';
import { AnchorProvider } from '@coral-xyz/anchor';
import { BN } from 'bn.js';

// Constants
const NFT_BEATER_PROGRAM_ID = new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");
const MERKLE_TREE_ADDRESS = new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
const FEE_RECEIVER = new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY");
const BASE_URI = "https://gateway.pinit.io/ipfs/Qmd4SP1MEzoXQK5ZcEsMnUpmEMuvqJF8H6VMLyJfLAwrtw";

// Parameters
const CONCURRENCY = 25; // Number of concurrent requests
const MAX_NFTS = 10000; // Maximum number of NFTs to check
const CHUNK_SIZE = 500; // Size of chunks for uploading

interface NFTMetadata {
  index: number;
  metadata: any;
  score?: number;
}

/**
 * Fetch all NFT metadata using PromisePool for concurrent processing
 */
async function fetchAllNFTMetadata() {
  console.log("Starting to fetch all NFT metadata using PromisePool...");
  
  const nftMetadata: NFTMetadata[] = [];
  const attributeCounts: Record<string, number> = {};
  
  // Create an array of indices from 0 to MAX_NFTS-1
  const indices = Array.from({ length: MAX_NFTS }, (_, i) => i);
  
  // Track number of 404s to detect end of collection
  let notFoundCount = 0;
  
  // Use PromisePool to process concurrently with rate limiting
  const { results, errors } = await PromisePool
    .withConcurrency(CONCURRENCY)
    .for(indices)
    .process(async (index) => {
      try {
        // Check if we've hit too many 404s in a row
        if (notFoundCount > 50) {
          return null; // Skip processing
        }
        
        const uri = `${BASE_URI}/${index}.json`;
        const response = await axios.get(uri, { timeout: 10000 });
        
        if (response.status === 200 && response.data) {
          console.log(`Successfully fetched NFT #${index}`);
          notFoundCount = 0; // Reset counter on success
          
          const metadata = response.data;
          nftMetadata.push({
            index,
            metadata
          });
          
          // Track attribute occurrences for rarity calculation
          if (metadata.attributes) {
            metadata.attributes.forEach((attr: { trait_type: string, value: string }) => {
              const key = `${attr.trait_type}:${attr.value}`;
              attributeCounts[key] = (attributeCounts[key] || 0) + 1;
            });
          }
          
          // Save progress every 100 successful fetches
          if (nftMetadata.length % 100 === 0) {
            saveProgress(nftMetadata, attributeCounts);
          }
          
          return { index, success: true };
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          notFoundCount++;
          console.log(`NFT #${index} not found (404). Not found count: ${notFoundCount}`);
          
          if (notFoundCount > 50) {
            console.log(`Detected probable end of collection after ${notFoundCount} consecutive 404s`);
          }
        } else {
          console.error(`Error fetching NFT #${index}:`, error);
        }
        return { index, success: false, error };
      }
    });
  
  // Calculate total fetched
  const successCount = results.filter(r => r && r.success).length;
  console.log(`Completed fetching metadata. Successfully fetched ${successCount} NFTs.`);
  console.log(`Encountered ${errors.length} errors.`);
  
  // Calculate rarity scores
  calculateRarityScores(nftMetadata, attributeCounts);
  
  // Save final results
  saveProgress(nftMetadata, attributeCounts, true);
  
  return nftMetadata;
}

/**
 * Calculate rarity scores for each NFT based on attribute rarity
 */
function calculateRarityScores(nftMetadata: NFTMetadata[], attributeCounts: Record<string, number>) {
  console.log("Calculating rarity scores...");
  
  const totalNFTs = nftMetadata.length;
  
  // Calculate raw rarity scores for each NFT
  for (const nft of nftMetadata) {
    let rarityScore = 0;
    
    if (nft.metadata.attributes) {
      for (const attr of nft.metadata.attributes) {
        const key = `${attr.trait_type}:${attr.value}`;
        const attributeCount = attributeCounts[key] || 0;
        
        // Rarity score formula: rarer attributes have higher scores
        if (attributeCount > 0) {
          const attributeRarity = 1 / (attributeCount / totalNFTs);
          rarityScore += attributeRarity;
        }
      }
    }
    
    // Store raw score for normalization
    nft.score = rarityScore;
  }
  
  // Normalize scores to 0-100 range using min-max scaling
  const scores = nftMetadata.map(nft => nft.score || 0);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore;
  
  for (const nft of nftMetadata) {
    if (nft.score !== undefined) {
      // Normalize to 0-100 range
      const normalizedScore = range === 0 ? 50 : // If all items have same rarity, assign 50
        Math.round(((nft.score - minScore) / range) * 100);
      nft.score = normalizedScore;
    }
  }
  
  // Sort by rarity score in descending order
  nftMetadata.sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Display top 10 rarest NFTs
  console.log("Top 10 Rarest NFTs:");
  for (let i = 0; i < Math.min(10, nftMetadata.length); i++) {
    const nft = nftMetadata[i];
    console.log(`${i + 1}. NFT #${nft.index} - Score: ${nft.score} - Name: ${nft.metadata?.name || 'Unknown'}`);
  }
}

/**
 * Save progress to file
 */
function saveProgress(nftMetadata: NFTMetadata[], attributeCounts: Record<string, number>, isFinal = false) {
  const filename = isFinal ? 'menagerie-rarity-data.json' : 'menagerie-metadata-progress.json';
  
  // Prepare data for saving
  const data = {
    lastUpdated: new Date().toISOString(),
    totalNFTs: nftMetadata.length,
    rarityScores: nftMetadata.map(nft => ({
      index: nft.index,
      score: nft.score || 0,
      metadata: nft.metadata
    }))
  };
  
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`Progress saved to ${filename}: ${nftMetadata.length} NFTs`);
}

/**
 * Upload rarity data to the on-chain program
 */
async function uploadRarityData(nftMetadata: NFTMetadata[]) {
  console.log("Starting rarity data upload...");
  
  try {
    // Connect to Solana
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    
    // Load wallet from keypair file
    const wallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(
        path.resolve(process.env.KEYPAIR_PATH || '/Users/jarettdunn/ddgb.json'), 
        'utf-8'
      )))
    );
    
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Get the NFT Beater PDA
    const [nftBeaterPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('nft-beater'),
        MERKLE_TREE_ADDRESS.toBuffer(),
      ],
      NFT_BEATER_PROGRAM_ID
    );
    
    console.log(`NFT Beater PDA: ${nftBeaterPDA.toString()}`);
    
    // Find maximum NFT index
    const maxIndex = Math.max(...nftMetadata.map(item => item.index));
    console.log(`Maximum NFT index: ${maxIndex}`);
    
    // Create a rarity array with all indices from 0 to maxIndex
    const rarityArray = new Array(3000).fill(0);
    
    // Fill in the rarity scores we have
    nftMetadata.forEach(item => {
      if (item.index !== undefined && item.score !== undefined) {
        rarityArray[item.index] = Math.floor(item.score);
      }
    });
    
    console.log(`Uploading ${rarityArray.length} rarity scores in chunks of ${CHUNK_SIZE}...`);
    
    // Process chunks
    // Initialize Anchor provider and program
    const provider = new AnchorProvider(
      connection,
      new Wallet(wallet),
      { commitment: 'confirmed', skipPreflight: true }
    );
    
    // Load Anchor IDL
    let idl;
    try {
      idl = JSON.parse(fs.readFileSync('./target/idl/nfting.json', 'utf-8'));
    } catch (e) {
      console.error("IDL file not found. Make sure you've built the program with 'anchor build'");
      process.exit(1);
    }
    
    // Create the program
    // @ts-ignore
    const program = new Program(idl, NFT_BEATER_PROGRAM_ID, provider);
    // Initialize with rarity thresholds instead of the full array
    // This fixes the "Blob.encode[data] requires Buffer as src" error
    const rarityThresholds = [50, 75, 90]; // Common, Rare, Legendary thresholds
    
    try {
      const tx = await program.methods
        .initialize(Buffer.from(rarityThresholds))
        .accounts({
          state: nftBeaterPDA,
          merkleTree: MERKLE_TREE_ADDRESS,
          merkleTreeAccount: MERKLE_TREE_ADDRESS,
          authority: wallet.publicKey,
          feeReceiver: FEE_RECEIVER,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc({skipPreflight: true});
      
      console.log(`Initialization transaction confirmed: https://solscan.io/tx/${tx}`);
    } catch (error) {
      // If account already initialized, we can proceed
      if (error?.message?.includes('already in use')) {
        console.log('NFT Beater state already initialized');
      } else {
        console.error("Error initializing NFT Beater state:", error);
      }
    }
    // Upload each chunk
    for (let i = 0; i < rarityArray.length; i += CHUNK_SIZE) {
      const chunk = rarityArray.slice(i, i + CHUNK_SIZE);
      const buffer = Buffer.from(chunk);
      
      console.log(`Uploading chunk ${i} to ${i + chunk.length - 1} (${chunk.length} items)`);
      
      try {
        // Create and send the transaction
        // @ts-ignore
        const tx = await program.methods
          .updateRarityData(new BN(i), buffer)
          .accounts({
            merkleTree: MERKLE_TREE_ADDRESS,
            state: nftBeaterPDA,
            authority: wallet.publicKey,
            feeReceiver: FEE_RECEIVER,
            systemProgram: SystemProgram.programId,
          })
          .signers([wallet])
          .rpc({skipPreflight: true});
        
        console.log(`Transaction confirmed: https://solscan.io/tx/${tx}`);
        console.log(`Updated rarity data for indices ${i} through ${i + chunk.length - 1}`);
        
        // Add a small delay between transactions
        if (i + CHUNK_SIZE < rarityArray.length) {
          console.log("Waiting for 2 seconds before next chunk...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.error(`Error uploading chunk starting at ${i}:`, e);
        console.error(e);
        // Continue with next chunk even if this one fails
      }
    }
    
    console.log("Rarity data upload complete!");
    
  } catch (error) {
    console.error("Error uploading rarity data:", error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    // First fetch all metadata and calculate rarity
    const nftMetadata = await fetchAllNFTMetadata();
    
    // Then upload the rarity data
    await uploadRarityData(nftMetadata);
    
  } catch (error) {
    console.error("Error in main execution:", error);
  }
}

// Run the script
main().then(
  () => process.exit(0),
  (error) => {
    console.error("Error in main function:", error);
    process.exit(1);
  }
); 