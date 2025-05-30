import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const NFT_BEATER_PROGRAM_ID = new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");
const MERKLE_TREE_ADDRESS = new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
const FEE_RECEIVER = new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY");

/**
 * Upload rarity data to the on-chain program
 */
async function uploadRarityData() {
  console.log("Starting rarity data upload...");
  
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
    
    // Initialize Anchor provider and program
    const walletWrapper = new Wallet(wallet);
    const provider = new AnchorProvider(
      connection,
      walletWrapper,
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
    const program = new Program(idl, new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb"),provider);
    
    // Get the NFT Beater PDA
    const [nftBeaterPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from('nft-beater'),
        MERKLE_TREE_ADDRESS.toBuffer(),
      ],
      NFT_BEATER_PROGRAM_ID
    );
    
    console.log(`NFT Beater PDA: ${nftBeaterPDA.toString()}`);
    
    // Prepare the rarity data from our JSON
    const scores = rarityData.rarityScores || [];
    console.log(`Loaded ${scores.length} rarity scores from JSON`);
    
    // Find maximum NFT index
    const maxIndex = Math.max(...scores.map(item => item.index));
    console.log(`Maximum NFT index: ${maxIndex}`);
    
    // Create a rarity array with all indices from 0 to maxIndex
    // Use Uint8Array instead of regular array to ensure proper Buffer encoding
    // Create a rarity array with all indices from 0 to maxIndex
    // Use Buffer with fixed length to ensure proper encoding
    const rarityArray = Buffer.alloc(100, 0);
    // Fill in the rarity scores we have
    scores.forEach(item => {
      if (item.index !== undefined && item.score !== undefined) {
        rarityArray[item.index] = Math.floor(item.score);
      }
    });
    
    // Split data into chunks to avoid transaction size limits
    const chunkSize = 900; // Keep chunks smaller to avoid transaction size limits
    
    console.log(`Uploading ${rarityArray.length} rarity scores in chunks of ${chunkSize}...`);
    
    try {
      // Create and send the transaction
      // @ts-ignore
      const tx = await program.methods
        .initialize(rarityArray)
        .accounts({
          merkleTreeAccount: MERKLE_TREE_ADDRESS,
          state: nftBeaterPDA,
          merkleTree: MERKLE_TREE_ADDRESS,
          authority: wallet.publicKey,
          feeReceiver: FEE_RECEIVER,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
        .rpc({skipPreflight: true});
      
      console.log(`Transaction confirmed: https://solscan.io/tx/${tx}`);
      
      // Add a small delay between transactions
    } catch (e) {
      console.error(e);
      // Continue with next chunk even if this one fails
    }
    // Upload each chunk
    for (let i = 0; i < rarityArray.length; i += chunkSize) {
      const chunk = rarityArray.slice(i, i + chunkSize);
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
      } catch (e) {
        console.error(`Error uploading chunk starting at ${i}:`, e);
        console.error(e);
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
uploadRarityData().then(
  () => process.exit(0),
  (error) => {
    console.error("Error in main function:", error);
    process.exit(1);
  }
); 