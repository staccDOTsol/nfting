import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionInstruction,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableProgram,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Program, AnchorProvider, web3, BN, utils, Wallet } from '@coral-xyz/anchor';
import * as dotenv from 'dotenv';
import * as bs58 from 'bs58';
import { Buffer } from 'buffer';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

dotenv.config();

// Constants
const NFT_BEATER_PROGRAM_ID = new PublicKey('14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb');
const MENAGERIE_PROGRAM_ID = new PublicKey('F9SixdqdmEBP5kprp2gZPZNeMmfHJRCTMFjN22dx3akf');
const MPL_CORE_PROGRAM_ID = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const STATE_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
const BUBBLEGUM_PROGRAM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Fixed addresses from the successful transaction
const FIXED_ADDRESSES = {
  authority: new PublicKey('22W96vbcDd1HaX6QUsuwJzoBNSWnBV3uHUAMWGiLUyyb'),
  artistWallet: new PublicKey('BYhzyAdSwF9Zg14t91gzAMtvHXewHVYpNeWXTDB9Cgqw'),
  feeReceiver: new PublicKey('33nQCgievSd3jJLSWFBefH3BJRN7h6sAoS82VFFdJGF5'),
  collectionMint: new PublicKey('44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH'),
  royaltyReceiver: new PublicKey('BYhzyAdSwF9Zg14t91gzAMtvHXewHVYpNeWXTDB9Cgqw'),
};

// Get RPC URL from environment variables
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// MintCore instruction discriminator (from transaction)
const MINT_CORE_DISCRIMINATOR = 'b7317780a38b2df8';

/**
 * Creates a MintCore instruction with proper formatting based on the successful transaction
 */
function createMintCoreInstruction(
  payer: PublicKey,
  nftIndex: number
): { instruction: TransactionInstruction, nftMintKeypair: Keypair } {
  // Create a new account keypair for the NFT asset
  const nftMintKeypair = Keypair.generate();
  
  // This formats the data exactly as seen in the successful transaction
  const data = Buffer.from("b7317780a38b2df80000000080f0fa020000000001000000000100", "hex")
  // Create a temporary account keypair for the asset
  const tempNftAccount = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_state"), nftMintKeypair.publicKey.toBuffer()],
    MENAGERIE_PROGRAM_ID
  )[0];
  // Account list exactly matching the successful transaction
  return {
    instruction: new TransactionInstruction({
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },                      // #1
        { pubkey: payer, isSigner: true, isWritable: true },                      // #2 
        { pubkey: FIXED_ADDRESSES.authority, isSigner: false, isWritable: true },  // #3
        { pubkey: new PublicKey("HCrfgM6EPmALTxae6toVe3GFihCn4jFp43NHHo6DdGvF"), isSigner: false, isWritable: true },  // #4 - Will be created in an inner instruction
        { pubkey: FIXED_ADDRESSES.artistWallet, isSigner: false, isWritable: true }, // #5
        { pubkey: FIXED_ADDRESSES.feeReceiver, isSigner: false, isWritable: true }, // #6
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },  // #7 - System Program
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },     // #8
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },     // #9
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },     // #10
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },     // #11
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },     // #12
        { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // #13
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },         // #14
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },    // #15
        { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false }, // #16
        { pubkey: STATE_COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false }, // #17
        { pubkey: NOOP_PROGRAM_ID, isSigner: false, isWritable: false },          // #18
        { pubkey: SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false }, // #19
        { pubkey: BUBBLEGUM_PROGRAM_ID, isSigner: false, isWritable: false },     // #20
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },     // #21
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },     // #22
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // #23
        { pubkey: MPL_CORE_PROGRAM_ID, isSigner: false, isWritable: false },      // #24
        { pubkey: new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH"), isSigner: false, isWritable: true }, // #25
        { pubkey: nftMintKeypair.publicKey, isSigner: true, isWritable: true },   // #26
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },    // #27
        { pubkey: new PublicKey("BYhzyAdSwF9Zg14t91gzAMtvHXewHVYpNeWXTDB9Cgqw"), isSigner: false, isWritable: true }, // #28
        { pubkey: new PublicKey("BYhzyAdSwF9Zg14t91gzAMtvHXewHVYpNeWXTDB9Cgqw"), isSigner: false, isWritable: true }, // #29
        { pubkey: new PublicKey("D9MvUbo9tfzqddLJZhfGVeLRaByravHgPTSPY15B7xMV"), isSigner: false, isWritable: true }, // #30
      ],
      programId: MENAGERIE_PROGRAM_ID,
      data,
    }),
    nftMintKeypair
  };
}

/**
 * Mint an NFT using the Menagerie program's MintCore instruction
 */
async function mintNFT(nftIndex: number) {
  try {
    // Load wallet from file or environment
    let payer: Keypair;
    const walletPath = path.join(process.env.HOME || '', 'ddgb.json');
    
    if (fs.existsSync(walletPath)) {
      const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
      payer = Keypair.fromSecretKey(Uint8Array.from(walletData));
      console.log(`Loaded wallet from ${walletPath}`);
    } else if (process.env.WALLET_PRIVATE_KEY) {
      payer = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY))
      );
      console.log("Loaded wallet from environment variable");
    } else {
      console.log("No wallet found, generating new keypair");
      payer = Keypair.generate();
    }

    // Connect to the Solana network
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Check wallet balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`Wallet balance: ${balance / 1_000_000_000} SOL`);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add compute budget instructions exactly as in the successful transaction
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 40000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 175000 })
    );
    
    // Create the Menagerie MintCore instruction with the correct NFT index
    const { instruction, nftMintKeypair } = createMintCoreInstruction(
      payer.publicKey,
      nftIndex
    );
    
    // Add the MintCore instruction to transaction
    transaction.add(instruction);
    
    // add the verify


    // Process chunks
    // Initialize Anchor provider and program
    const provider = new AnchorProvider(
      connection,
      new Wallet(payer),
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

    // Get the NFT Beater PDA
    const [nftBeaterPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('nft-beater'),
         new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH").toBuffer(),
      ],
      NFT_BEATER_PROGRAM_ID
    );
    
    const feeReceiver = new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY");
  try {
      const ix = await program.methods
        .validateMintCore(new BN(50))
        .accounts({
          assetAccount: nftMintKeypair.publicKey,
          state: nftBeaterPDA,
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          merkleTree: new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH"),
          merkleTreeAccount: new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH"),
          authority: payer.publicKey,
          feeReceiver: feeReceiver,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
    transaction.add(ix);
    } catch (e) {
      console.error('Error validating mint:', e);
      process.exit(1);
    }
    // Set fee payer
    transaction.feePayer = payer.publicKey;
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    
    console.log(`Minting Core NFT #${nftIndex}`);
    console.log(`Generated asset keypair: ${nftMintKeypair.publicKey.toString()}`);
    console.log(`MintCore instruction data: ${bs58.encode(instruction.data)}`);
    
    // Sign transaction
    transaction.sign(payer, nftMintKeypair);
    
    // Send and confirm transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true
    });
    
    console.log(`Transaction signature: ${signature}`);
    console.log(`https://solscan.io/tx/${signature}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`Transaction confirmed! NFT minted successfully.`);
    
    return {
      signature,
      nftMint: nftMintKeypair.publicKey.toString()
    };
  } catch (error) {
    console.error('Error minting NFT:', error);
    throw error;
  }
}

// Run mint function with command line arg for NFT index
async function main() {
  const args = process.argv.slice(2);
  const nftIndex = args.length > 0 ? parseInt(args[0]) : 886; // Default to index 886
  
  try {
    const result = await mintNFT(nftIndex);
    console.log('Mint result:', result);
  } catch (error) {
    console.error('Error in main execution:', error);
  }
}

// Only execute if this is the main file
if (require.main === module) {
  main();
}

export { mintNFT }; 