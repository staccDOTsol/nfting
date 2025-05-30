import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SendTransactionError,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// Constants
const NFT_BEATER_PROGRAM_ID = new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");
const MERKLE_TREE_ADDRESS = new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
const FEE_RECEIVER = new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY");

// Generate the 8-byte discriminator for an Anchor instruction
function getInstructionDiscriminator(name: string): Buffer {
  return Buffer.from(
    createHash('sha256')
      .update(`global:${name}`)
      .digest()
      .slice(0, 8)
  );
}

/**
 * Initialize the NFT Beater account
 */
async function initializeNFTBeater() {
  console.log("Starting NFT Beater initialization...");
  
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
    
    // Check if the account already exists
    const accountInfo = await connection.getAccountInfo(nftBeaterPDA);
    if (accountInfo !== null) {
      console.log("NFT Beater account already initialized!");
      return;
    }
    
    console.log("Account not found, preparing to initialize...");
    
    // Create rarity thresholds (example values for testing)
    const rarityThresholds = [50, 75, 90];
    
    // Get the proper Anchor instruction discriminator for "initialize"
    const initializeDiscriminator = getInstructionDiscriminator("initialize");
    console.log(`Initialize discriminator: ${Buffer.from(initializeDiscriminator).toString('hex')}`);
    
    // Merkle tree address
    const merkleTreeBuffer = MERKLE_TREE_ADDRESS.toBuffer();
    
    // Create a fixed-size buffer for rarity thresholds (100 bytes as required by the program)
    const rarityDataBuffer = Buffer.alloc(100, 0); // Initialize with zeros
    
    // Write the length of the thresholds array as a u32
    rarityDataBuffer.writeUInt32LE(rarityThresholds.length, 0);
    
    // Write each threshold value to the buffer
    for (let i = 0; i < rarityThresholds.length; i++) {
      rarityDataBuffer.writeUInt8(rarityThresholds[i], 4 + i);
    }
    
    // Create the full instruction data
    const instructionData = Buffer.concat([
      initializeDiscriminator,
      merkleTreeBuffer,
      rarityDataBuffer
    ]);
    
    console.log(`Initializing with rarity thresholds: ${rarityThresholds}`);
    console.log(`Total instruction data length: ${instructionData.length} bytes`);
    
    // Create the instruction for initializing the account based on the Rust program
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: nftBeaterPDA, isSigner: false, isWritable: true },       // state
        { pubkey: MERKLE_TREE_ADDRESS, isSigner: false, isWritable: false }, // merkle_tree
        { pubkey: MERKLE_TREE_ADDRESS, isSigner: false, isWritable: false }, // merkle_tree_account (same as merkle_tree)
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },    // authority
        { pubkey: FEE_RECEIVER, isSigner: false, isWritable: true },       // fee_receiver
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: NFT_BEATER_PROGRAM_ID,
      data: instructionData,
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    console.log("Sending initialization transaction...");
    
    try {
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet],
        { commitment: 'confirmed', skipPreflight: true }
      );
      
      console.log(`Initialization transaction confirmed: https://solscan.io/tx/${signature}`);
      console.log("NFT Beater account successfully initialized!");
    } catch (err) {
      console.error("Error initializing NFT Beater account:", err);
      
      // Get the signature from error message
      const signatureMatch = err.toString().match(/Transaction ([\w\d]+) /);
      const signature = signatureMatch ? signatureMatch[1] : null;
      
      if (signature) {
        try {
          // Get detailed logs
          console.log(`Fetching logs for signature: ${signature}`);
          const txInfo = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });
          console.error("Transaction logs:", txInfo?.meta?.logMessages);
        } catch (logErr) {
          console.error("Could not fetch transaction logs:", logErr);
        }
      }
      throw err;
    }
    
  } catch (error) {
    console.error("Error initializing NFT Beater account:", error);
    throw error;
  }
}

// Run the initialization function
initializeNFTBeater().then(
  () => process.exit(0),
  (error) => {
    console.error("Error in main function:", error);
    process.exit(1);
  }
); 