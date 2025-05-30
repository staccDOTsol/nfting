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

// Constants
const NFT_BEATER_PROGRAM_ID = new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");
const MERKLE_TREE_ADDRESS = new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
const FEE_RECEIVER = new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY");

/**
 * Update rarity data in the on-chain program using direct transactions instead of Anchor
 */
async function updateRarityData() {
  console.log("Starting direct rarity data update...");
  
  try {
    // Load rarity data JSON file
    const rarityData = JSON.parse(fs.readFileSync('menagerie-rarity-data.json', 'utf-8'));
    
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
    
    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(nftBeaterPDA);
    if (accountInfo === null) {
      console.error("NFT Beater account does not exist. Please initialize it first.");
      return;
    }
    
    console.log("NFT Beater account found, preparing rarity data...");
    
    // Prepare the rarity data from our JSON
    const scores = rarityData.rarityScores || [];
    console.log(`Loaded ${scores.length} rarity scores from JSON`);
    
    // Find maximum NFT index
    const maxIndex = Math.max(...scores.map(item => item.index));
    console.log(`Maximum NFT index: ${maxIndex}`);
    
    // Create a rarity array with all indices from 0 to maxIndex
    const rarityArray = new Array(maxIndex + 1).fill(0);
    
    // Fill in the rarity scores we have
    scores.forEach(item => {
      if (item.index !== undefined && item.score !== undefined) {
        rarityArray[item.index] = Math.floor(item.score);
      }
    });
    
    // Split data into chunks to avoid transaction size limits
    const chunkSize = 250; // Smaller chunks for better reliability
    
    console.log(`Uploading ${rarityArray.length} rarity scores in chunks of ${chunkSize}...`);
    
    // Process chunks
    for (let i = 0; i < rarityArray.length; i += chunkSize) {
      const chunk = rarityArray.slice(i, i + chunkSize);
      const buffer = Buffer.from(new Uint8Array(chunk));
      
      console.log(`Uploading chunk ${i} to ${i + chunk.length - 1} (${chunk.length} items)`);
      
      try {
        // Create instruction data
        // Format: [2, ...i64_start_index, ...data]
        // 2 is the instruction discriminator for updateRarityData
        const startIndex = i;
        const indexBuffer = Buffer.alloc(8);
        indexBuffer.writeBigUInt64LE(BigInt(startIndex), 0);
        
        const instructionData = Buffer.concat([
          Buffer.from([2]), // Instruction discriminator for update_rarity_data
          indexBuffer,      // Start index
          buffer,           // Rarity data
        ]);
        
        // Create the instruction for uploading rarity data
        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: nftBeaterPDA, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: FEE_RECEIVER, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: NFT_BEATER_PROGRAM_ID,
          data: instructionData,
        });
        
        // Create and send transaction
        const transaction = new Transaction().add(instruction);
        transaction.feePayer = wallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [wallet],
          { commitment: 'confirmed', skipPreflight: true }
        );
        
        console.log(`Transaction confirmed: https://solscan.io/tx/${signature}`);
        console.log(`Updated rarity data for indices ${i} through ${i + chunk.length - 1}`);
        
        // Add a small delay between transactions
        if (i + chunkSize < rarityArray.length) {
          console.log("Waiting for 2 seconds before next chunk...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.error(`Error uploading chunk starting at ${i}:`, e);
        // Continue with next chunk even if this one fails
      }
    }
    
    console.log("Rarity data upload complete!");
    
    // Show top 10 rarest NFTs
    const topRarest = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    console.log("\nTop 10 Rarest NFTs:");
    for (let i = 0; i < topRarest.length; i++) {
      const nft = topRarest[i];
      console.log(`${i + 1}. NFT #${nft.index} - Score: ${nft.score} - Name: ${nft.metadata?.name || 'Unknown'}`);
    }
  } catch (error) {
    console.error("Error processing rarity data:", error);
    throw error;
  }
}

// Run the upload function
updateRarityData().then(
  () => process.exit(0),
  (error) => {
    console.error("Error in main function:", error);
    process.exit(1);
  }
); 