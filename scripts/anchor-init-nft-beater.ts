import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, BN, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const NFT_BEATER_PROGRAM_ID = new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");
const MERKLE_TREE_ADDRESS = new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
const FEE_RECEIVER = new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY");

/**
 * Initialize the NFT Beater account using Anchor
 */
async function initializeNFTBeater() {
  console.log("Starting NFT Beater initialization with Anchor...");
  
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
    
    // Create the Anchor provider
    const provider = new AnchorProvider(
      connection,
      new Wallet(wallet),
      { commitment: 'confirmed', skipPreflight: true }
    );
    
    // Load the IDL
    let idl;
    try {
      idl = JSON.parse(fs.readFileSync('./target/idl/nfting.json', 'utf-8'));
      console.log("Loaded IDL from local file");
    } catch (e) {
      console.error("Could not load IDL, attempting to fetch from chain...");
      idl = await Program.fetchIdl(NFT_BEATER_PROGRAM_ID, provider);
      if (!idl) {
        throw new Error("Failed to load IDL from chain");
      }
      console.log("Loaded IDL from chain");
    }
    
    // Create program interface
    // @ts-ignore - Anchor types might not match exactly
    const program = new Program(idl, NFT_BEATER_PROGRAM_ID, provider);
    
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
    console.log(`Initializing with rarity thresholds: ${rarityThresholds}`);
    
    // Call initialize instruction
    try {
      const tx = await program.methods
        .initialize(MERKLE_TREE_ADDRESS, Buffer.from(rarityThresholds))
        .accounts({
          state: nftBeaterPDA,
          merkleTree: MERKLE_TREE_ADDRESS,
          merkleTreeAccount: MERKLE_TREE_ADDRESS,
          authority: wallet.publicKey,
          feeReceiver: FEE_RECEIVER,
          systemProgram: PublicKey.default,
        })
        .signers([wallet])
        .rpc();
        
      console.log(`Initialization transaction confirmed: https://solscan.io/tx/${tx}`);
      console.log("NFT Beater account successfully initialized!");
    } catch (err) {
      console.error("Error initializing NFT Beater account:", err);
      
      // Try to extract transaction signature and fetch logs
      const signatureMatch = err.toString().match(/Transaction ([\w\d]+) /);
      const signature = signatureMatch ? signatureMatch[1] : null;
      
      if (signature) {
        try {
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