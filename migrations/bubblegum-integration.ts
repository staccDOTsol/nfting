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
  VersionedTransaction,
  TransactionMessage
} from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN, Wallet } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';

// Require the IDL as a workaround for the .json module resolution issue
const idl = require('../target/idl/nfting.json');

// Program IDs
const NFTING_PROGRAM_ID = new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");
const MENAGERIE_PROGRAM_ID = new PublicKey("F9SixdqdmEBP5kprp2gZPZNeMmfHJRCTMFjN22dx3akf");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const BUBBLEGUM_PROGRAM_ID = new PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");
const COMPRESSION_PROGRAM_ID = new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
const SPL_ACCOUNT_COMPRESSION_ID = new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
const SPL_NOOP_ID = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");
const TOKEN_AUTH_RULES_ID = new PublicKey("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// Constants for settings
const DEFAULT_COMPUTE_UNITS = 525_000;
const DEFAULT_COMPUTE_PRICE = 58767; // microLamports
const DEFAULT_TIP_AMOUNT = 0.0001; // SOL

// IPFS metadata URI for Menagerie NFTs
const IPFS_METADATA_BASE_URI = "https://gateway.pinit.io/ipfs/Qmd2mt5hpF9d9QMDhpX9SecoPsvdpqcGVnP7ETfxB6hrr3";

/**
 * Interface for NFT metadata
 */
interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
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

/**
 * Class for handling Menagerie NFT minting
 */
export class MenagerieMinter {
  private connection: Connection;
  private wallet: Keypair;
  private rarityProgram?: Program;
  private jitoEndpoint?: string;
  
  // Known addresses from transaction examples
  private readonly ADDRESSES = {
    paymentReceiver1: new PublicKey("BYhzyAdSwF9Zg14t91gzAMtvHXewHVYpNeWXTDB9Cgqw"),
    paymentReceiver2: new PublicKey("Gmxpfs55fBNDT1VeHszFAVrKUjwv2bh8RJP32tT1kQWX"),
    paymentReceiver3: new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH"),
    royaltyAddress: new PublicKey("Gxwp3tF5dueE4ok5knQyZKiHSrMgVC4V1idUq9MkRoqc"),
    metadataAddress: new PublicKey("DdyCxHFxXi4Mb69giqujAFrkcS1eZTjBGnYsR5hUzBzr"),
    updateAuthorityAddress: new PublicKey("y6bA3gBy5dsRzVqJV4choAWCNWVVzW8yNLmFz2pV6yw"),
    storageAccount: new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH"),
    collectionMint: new PublicKey("CXbixcWqWyCiwxhHqMPbveQUjeL9r4H3RUZd9LFKcBhe"),
    collectionMetadata: new PublicKey("H2iK73hVAxG4J4tbbEJEoieeLakwQSBiXaPFw9R5BSCA"),
    collectionMasterEdition: new PublicKey("CGduSUxsYpoxBUgPKjGw4Amwp3c3hwX7kPNt2VnE63ip"),
    delegateRecord: new PublicKey("8FTdJhScU4HYruSXkpYXWo9VvB7kSKWjUQQmDMEDaFky"),
    tokenRecord: new PublicKey("E78TyVGQEg469gZsknn1k8wvjenwkyV7zVYUdrCAr9Pb"),
    authRules: new PublicKey("eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9"),
    tipAddress: new PublicKey("Jitotip3UZPKWjEGZecn8gjNmqYKtJ7HA1JpQYKKR6w")
  };
  
  constructor(
    connection: Connection,
    wallet: Keypair,
    options?: {
      jitoEndpoint?: string;
    }
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.jitoEndpoint = options?.jitoEndpoint;
    
    // Initialize the rarity program
    try {
      const walletAdapter = new Wallet(wallet);
      const provider = new AnchorProvider(
        connection,
        walletAdapter,
        { commitment: 'confirmed', skipPreflight: true }
      );
      // @ts-ignore
      this.rarityProgram = new Program(idl as any, NFTING_PROGRAM_ID, provider);
      console.log("Rarity assessment program initialized");
    } catch (error) {
      console.warn("Could not initialize rarity program, continuing without it:", error);
    }
  }
  
  /**
   * Check rarity before minting
   */
  async checkRarity(nftIndex: number, minRarityPercentage: number = 50): Promise<boolean> {
    if (!this.rarityProgram) {
      console.warn("Rarity program not initialized, skipping rarity check");
      return true;
    }
    
    try {
      console.log(`Checking if NFT #${nftIndex} meets rarity threshold of ${minRarityPercentage}%`);
      
      // Get the rarity state PDA
      const [rarityState] = await PublicKey.findProgramAddress(
        [
          Buffer.from('nft-beater'),
          this.ADDRESSES.storageAccount.toBuffer(),
        ],
        NFTING_PROGRAM_ID
      );
      
      // Call the validate_mint function
      const result = await this.rarityProgram.methods
        .validateMint(new BN(nftIndex), minRarityPercentage)
        .accounts({
          state: rarityState,
          merkleTree: this.ADDRESSES.storageAccount,
          treeConfig: await this.getTreeConfigPDA(),
          minter: this.wallet.publicKey,
          feeReceiver: new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
          systemProgram: SystemProgram.programId,
        })
        .simulate();
      
      console.log("Rarity check successful:", result);
      return true;
    } catch (error) {
      console.error("Rarity check failed:", error);
      if (error.logs) {
        console.error("Logs:", error.logs);
      }
      return false;
    }
  }
  
  /**
   * Get tree config PDA
   */
  private async getTreeConfigPDA(): Promise<PublicKey> {
    return (await PublicKey.findProgramAddress(
      [this.ADDRESSES.storageAccount.toBuffer()],
      BUBBLEGUM_PROGRAM_ID
    ))[0];
  }
  
  /**
   * Create mint instruction data buffer for the Menagerie program
   */
  private createMintInstructionData(nftIndex: number): Buffer {
    // The successful transaction instruction data is:
    // 738715186c2d5fe40000000080b2e60e000000000100000000010001
    
    // Use the exact byte pattern that works in the successful transactions
    return Buffer.from([
      // Instruction discriminator (fixed)
      0x73, 0x87, 0x15, 0x18, 0x6c, 0x2d, 0x5f, 0xe4, 
      
      // NFT index bytes - using exact pattern from successful transaction
      0x00, 0x00, 0x00, 0x00, 0x80, 0xb2, 0xe6, 0x0e,
      
      // Remaining fixed bytes
      0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x01
    ]);
  }
  
  /**
   * Create the mint instruction with all accounts needed
   */
  private createMintInstruction(
    nftIndex: number, 
    nftMintKeypair: Keypair
  ): TransactionInstruction {
    // Create an ATA for the NFT - this will be created during the transaction
    const tokenAccount = PublicKey.findProgramAddressSync(
      [
        this.wallet.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        nftMintKeypair.publicKey.toBuffer()
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
    
    console.log(`Token Account (ATA): ${tokenAccount.toString()}`);
    console.log(`NFT Mint: ${nftMintKeypair.publicKey.toString()}`);
    
    // The account order is critically important for the Menagerie program
    // This matches the exact account order from the successful transaction
    return new TransactionInstruction({
      programId: MENAGERIE_PROGRAM_ID,
      keys: [
        // #1 - Wallet - Writable, Signer
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        
        // #2 - ATA - Writable (will be created during transaction)
        { pubkey: tokenAccount, isSigner: false, isWritable: true },
        
        // #3 - Wallet AGAIN - Writable, Signer (duplicated as in successful tx)
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        
        // #4 - NFT Mint - Writable, Signer
        { pubkey: nftMintKeypair.publicKey, isSigner: true, isWritable: true },
        
        // Remaining accounts from successful transaction
        { pubkey: this.ADDRESSES.royaltyAddress, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.metadataAddress, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.updateAuthorityAddress, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.storageAccount, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.paymentReceiver1, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.paymentReceiver2, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.paymentReceiver3, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SPL_NOOP_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: BUBBLEGUM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.collectionMint, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.collectionMetadata, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.collectionMasterEdition, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.delegateRecord, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.tokenRecord, isSigner: false, isWritable: true },
        { pubkey: TOKEN_AUTH_RULES_ID, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.authRules, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.paymentReceiver1, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.paymentReceiver2, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("8X7Wn6hs9sSPAzH6gmrY25ewE8a5Bp6CquMCSEshGTef"), isSigner: false, isWritable: true },
      ],
      data: this.createMintInstructionData(nftIndex)
    });
  }
  
  /**
   * Create a complete mint transaction
   */
  async createMintTransaction(
    nftIndex: number,
    nftMintKeypair: Keypair,
    options?: {
      computeUnits?: number;
      computeUnitPrice?: number;
      includeTip?: boolean;
      tipAmount?: number;
    }
  ): Promise<Transaction> {
    const computeUnits = options?.computeUnits || DEFAULT_COMPUTE_UNITS;
    const computeUnitPrice = options?.computeUnitPrice || DEFAULT_COMPUTE_PRICE;
    const includeTip = options?.includeTip !== false; // Default to true
    const tipAmount = (options?.tipAmount || DEFAULT_TIP_AMOUNT) * LAMPORTS_PER_SOL;
    
    // Get latest blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    
    // Create a standard transaction
    const transaction = new Transaction();
    
    // Set blockhash and fee payer
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;
    
    // CRITICAL: Add compute budget instructions FIRST in this exact order
    // This matches the order from the successful transaction
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: computeUnitPrice
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits
      })
    );
    
    // Add mint instruction DIRECTLY (don't try to create ATA, it's handled by the program)
    transaction.add(
      this.createMintInstruction(nftIndex, nftMintKeypair)
    );
    
    // Add tip transaction if requested
    if (includeTip) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: this.ADDRESSES.tipAddress,
          lamports: tipAmount
        })
      );
    }
    
    return transaction;
  }
  
  /**
   * Mint a Menagerie NFT
   */
  async mintNFT(
    nftIndex: number,
    options?: {
      computeUnits?: number;
      computeUnitPrice?: number;
      includeTip?: boolean;
      tipAmount?: number;
      skipPreflight?: boolean;
      minRarityPercentage?: number;
    }
  ): Promise<{ signature: string; nftMint: PublicKey }> {
    console.log(`Minting Menagerie NFT #${nftIndex}`);
    
    // Check rarity if rarity program is available
    if (this.rarityProgram) {
      const rarityCheck = await this.checkRarity(nftIndex, options?.minRarityPercentage);
      if (!rarityCheck) {
        throw new Error(`NFT #${nftIndex} does not meet minimum rarity threshold`);
      }
    }
    
    // Generate a new keypair for the NFT mint
    const nftMintKeypair = Keypair.generate();
    console.log(`Generated mint keypair: ${nftMintKeypair.publicKey.toString()}`);
    
    // Create transaction
    const transaction = await this.createMintTransaction(
      nftIndex,
      nftMintKeypair,
      options
    );
    
    // Sign and send transaction
    try {
      // Explicitly sign with both keypairs to ensure they're recognized as signers
      transaction.sign(this.wallet, nftMintKeypair);
      
      // Send transaction without using sendAndConfirmTransaction which might be modifying the transaction
      const signature = await this.connection.sendTransaction(
        transaction, 
        [this.wallet, nftMintKeypair], 
        { 
          skipPreflight: options?.skipPreflight ?? true,
          preflightCommitment: 'confirmed'
        }
      );
      
      console.log(`Minted Menagerie NFT with signature: ${signature}`);
      console.log(`NFT Mint: ${nftMintKeypair.publicKey.toString()}`);
      
      return {
        signature,
        nftMint: nftMintKeypair.publicKey
      };
    } catch (error: any) {
      console.error("Error minting Menagerie NFT:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }
  
  /**
   * Batch mint multiple NFTs
   */
  async batchMintNFTs(
    startIndex: number,
    count: number,
    options?: {
      computeUnits?: number;
      computeUnitPrice?: number;
      includeTip?: boolean;
      tipAmount?: number;
      skipPreflight?: boolean;
      concurrentBatchSize?: number;
    }
  ): Promise<Array<{ signature: string; nftMint: PublicKey }>> {
    const concurrentBatchSize = options?.concurrentBatchSize || 5;
    const results: Array<{ signature: string; nftMint: PublicKey }> = [];
    
    // Mint in batches to avoid rate limits
    for (let i = 0; i < count; i += concurrentBatchSize) {
      const batchSize = Math.min(concurrentBatchSize, count - i);
      const batchPromises = Array.from({ length: batchSize }, (_, idx) => 
        this.mintNFT(startIndex + i + idx, options)
          .catch(error => {
            console.error(`Error minting NFT #${startIndex + i + idx}:`, error);
            return null;
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter(result => result !== null) as Array<{ signature: string; nftMint: PublicKey }>;
      results.push(...validResults);
      
      // Add delay between batches if needed
      if (i + concurrentBatchSize < count) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }
  
  /**
   * Submit mint transaction to JITO bundles if JITO endpoint is configured
   */
  async submitToJito(transaction: Transaction, signers: Keypair[]): Promise<string | null> {
    if (!this.jitoEndpoint) {
      throw new Error("JITO endpoint not configured");
    }
    
    try {
      // Sign transaction
      transaction.sign(...signers);
      
      // Serialize transaction
      const serializedTransaction = transaction.serialize();
      
      // Submit to JITO
      const response = await axios.post(this.jitoEndpoint, {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [
          [serializedTransaction.toString('base64')],
          {
            maxTimeout: 60000,
          },
        ],
      });
      
      if (response.data.error) {
        console.error("JITO error:", response.data.error);
        return null;
      }
      
      return response.data.result;
    } catch (error) {
      console.error("Error submitting to JITO:", error);
      return null;
    }
  }
  
  /**
   * Mint an NFT using a combined approach - bubblegum SDK structure but with explicit mint keypair
   */
  async mintNFTWithBubblegumSdk(
    nftIndex: number,
    options?: {
      skipPreflight?: boolean;
      minRarityPercentage?: number;
    }
  ): Promise<{ signature: string; nftMint: PublicKey }> {
    console.log(`Minting Menagerie NFT #${nftIndex} using combined approach`);
    
    // Check rarity if rarity program is available
    if (this.rarityProgram) {
      const rarityCheck = await this.checkRarity(nftIndex, options?.minRarityPercentage);
      if (!rarityCheck) {
        throw new Error(`NFT #${nftIndex} does not meet minimum rarity threshold`);
      }
    }
    
    // CRITICAL: Generate a mint keypair - Menagerie requires this
    const nftMintKeypair = Keypair.generate();
    console.log(`Generated mint keypair: ${nftMintKeypair.publicKey.toString()}`);
    
    // Create the ATA for the NFT
    const tokenAccount = PublicKey.findProgramAddressSync(
      [
        this.wallet.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        nftMintKeypair.publicKey.toBuffer()
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
    
    console.log(`Token Account (ATA): ${tokenAccount.toString()}`);
    
    // Create transaction with compute budget instructions
    const transaction = new Transaction();
    
    // Add compute budget instructions first
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: DEFAULT_COMPUTE_PRICE
      })
    );
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: DEFAULT_COMPUTE_UNITS
      })
    );
    
    // Use the exact account structure from the successful transaction
    const mintIx = new TransactionInstruction({
      programId: MENAGERIE_PROGRAM_ID,
      keys: [
        // #1 - Wallet - Writable, Signer
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        
        // #2 - ATA - Writable (will be created during transaction)
        { pubkey: tokenAccount, isSigner: false, isWritable: true },
        
        // #3 - Wallet AGAIN - Writable, Signer (duplicated)
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        
        // #4 - NFT Mint - Writable, Signer - THIS IS CRITICAL
        { pubkey: nftMintKeypair.publicKey, isSigner: true, isWritable: true },
        
        // Remaining accounts from successful transaction
        { pubkey: this.ADDRESSES.royaltyAddress, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.metadataAddress, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.updateAuthorityAddress, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.storageAccount, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.paymentReceiver1, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.paymentReceiver2, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.paymentReceiver3, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SPL_NOOP_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: BUBBLEGUM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.collectionMint, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.collectionMetadata, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.collectionMasterEdition, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.delegateRecord, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.tokenRecord, isSigner: false, isWritable: true },
        { pubkey: TOKEN_AUTH_RULES_ID, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.authRules, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: this.ADDRESSES.paymentReceiver1, isSigner: false, isWritable: true },
        { pubkey: this.ADDRESSES.paymentReceiver2, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("8X7Wn6hs9sSPAzH6gmrY25ewE8a5Bp6CquMCSEshGTef"), isSigner: false, isWritable: true },
      ],
      data: this.createMintInstructionData(nftIndex)
    });
    
    transaction.add(mintIx);
    
    // Add tip transaction
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: this.wallet.publicKey,
        toPubkey: this.ADDRESSES.tipAddress,
        lamports: DEFAULT_TIP_AMOUNT * LAMPORTS_PER_SOL
      })
    );
    
    // Get recent blockhash and set fee payer
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;
    
    // Sign and send transaction
    try {
      // CRITICAL: Sign with both the wallet and the mint keypair
      transaction.sign(this.wallet, nftMintKeypair);
      
      const signature = await this.connection.sendTransaction(
        transaction,
        [this.wallet, nftMintKeypair],
        {
          skipPreflight: options?.skipPreflight ?? true,
          preflightCommitment: 'confirmed'
        }
      );
      
      console.log(`Minted Menagerie NFT with signature: ${signature}`);
      console.log(`NFT Mint: ${nftMintKeypair.publicKey.toString()}`);
      
      return {
        signature,
        nftMint: nftMintKeypair.publicKey
      };
    } catch (error: any) {
      console.error("Error minting Menagerie NFT:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
  }
}

/**
 * Class for indexing and calculating rarity scores for Menagerie NFTs
 */
export class MenagerieRarityIndexer {
  // Maps to store frequencies and calculated rarity scores
  private attributeFrequencies: Map<string, Map<string, number>> = new Map();
  private metadataByIndex: Map<number, NFTMetadata> = new Map();
  private rarityScores: Map<number, number> = new Map();
  private totalIndexed: number = 0;
  private batchSize: number = 50;
  private connection: Connection;
  private wallet: Keypair;
  private rarityProgram?: Program;
  private merkleTreePubkey: PublicKey;
  
  constructor(
    connection: Connection,
    wallet: Keypair, 
    merkleTreePubkey: PublicKey,
    options?: {
      batchSize?: number
    }
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.merkleTreePubkey = merkleTreePubkey;
    if (options?.batchSize) {
      this.batchSize = options.batchSize;
    }
    
    // Initialize the rarity program
    try {
      const walletAdapter = new Wallet(wallet);
      const provider = new AnchorProvider(
        connection,
        walletAdapter,
        { commitment: 'confirmed', skipPreflight: true }
      );
      // @ts-ignore
      this.rarityProgram = new Program(idl as any, NFTING_PROGRAM_ID, provider);
      console.log("Rarity assessment program initialized");
    } catch (error) {
      console.warn("Could not initialize rarity program, continuing without it:", error);
    }
  }
  
  /**
   * Fetch metadata for a specific index
   */
  private async fetchNFTMetadata(index: number): Promise<NFTMetadata | null> {
    try {
      const uri = `${IPFS_METADATA_BASE_URI}/${index}.json`;
      const response = await axios.get(uri);
      return response.data;
    } catch (error) {
      console.error(`Error fetching metadata for index ${index}:`, error);
      return null;
    }
  }
  
  /**
   * Index NFT metadata in batches
   */
  async indexMetadataBatch(startIndex: number, count: number): Promise<void> {
    console.log(`Indexing batch from ${startIndex} to ${startIndex + count - 1}...`);
    
    // Prepare batch of requests
    const promises = Array.from({ length: count }, (_, i) => {
      const index = startIndex + i;
      return this.fetchNFTMetadata(index)
        .then(metadata => ({ index, metadata }))
        .catch(() => ({ index, metadata: null }));
    });
    
    // Process results
    const results = await Promise.all(promises);
    
    for (const { index, metadata } of results) {
      if (metadata) {
        this.metadataByIndex.set(index, metadata);
        this.totalIndexed++;
      }
    }
    
    console.log(`Indexed ${this.totalIndexed} NFTs so far.`);
  }
  
  /**
   * Index all metadata up to a specified count
   */
  async indexAllMetadata(totalCount: number): Promise<void> {
    console.log(`Starting to index ${totalCount} NFTs...`);
    
    for (let i = 0; i < totalCount; i += this.batchSize) {
      const batchCount = Math.min(this.batchSize, totalCount - i);
      await this.indexMetadataBatch(i, batchCount);
      
      // Add small delay to avoid rate limits
      if (i + this.batchSize < totalCount) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // After all metadata is indexed, calculate frequencies and scores
    this.calculateAttributeFrequencies();
    this.calculateRarityScores();
    
    console.log(`Successfully indexed and calculated rarity for ${this.totalIndexed} NFTs.`);
  }
  
  /**
   * Calculate frequency of each attribute value
   */
  private calculateAttributeFrequencies(): void {
    console.log("Calculating attribute frequencies...");
    
    this.attributeFrequencies.clear();
    
    // Count occurrences of each attribute
    this.metadataByIndex.forEach(metadata => {
      metadata.attributes.forEach(attribute => {
        const { trait_type, value } = attribute;
        const valueStr = String(value);
        
        if (!this.attributeFrequencies.has(trait_type)) {
          this.attributeFrequencies.set(trait_type, new Map());
        }
        
        const traitValues = this.attributeFrequencies.get(trait_type)!;
        traitValues.set(
          valueStr,
          (traitValues.get(valueStr) || 0) + 1
        );
      });
    });
    
    // Print some debug info
    this.attributeFrequencies.forEach((values, trait) => {
      console.log(`Trait "${trait}" has ${values.size} unique values`);
    });
  }
  
  /**
   * Calculate statistical rarity scores for each NFT
   */
  private calculateRarityScores(): void {
    console.log("Calculating statistical rarity scores...");
    
    const totalNFTs = this.metadataByIndex.size;
    
    // First pass - calculate raw rarity scores
    const rawScores = new Map<number, number>();
    
    this.metadataByIndex.forEach((metadata, index) => {
      let score = 0;
      
      metadata.attributes.forEach(attribute => {
        const { trait_type, value } = attribute;
        const valueStr = String(value);
        
        // Get frequency of this trait value
        const traitFrequencies = this.attributeFrequencies.get(trait_type);
        if (!traitFrequencies) return;
        
        const frequency = traitFrequencies.get(valueStr) || 0;
        if (frequency === 0) return;
        
        // Rarity score for this trait = 1 / frequency percentage
        const traitScore = 1 / (frequency / totalNFTs);
        score += traitScore;
      });
      
      rawScores.set(index, score);
    });
    
    // Normalize scores to 0-100 range
    const scores = Array.from(rawScores.values());
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore;
    
    rawScores.forEach((score, index) => {
      // Use min-max scaling to normalize to 0-100
      const normalizedScore = range === 0 
        ? 50 // If all have same rarity
        : Math.min(100, Math.round(((score - minScore) / range) * 100));
      
      this.rarityScores.set(index, normalizedScore);
    });
    
    console.log(`Normalized ${this.rarityScores.size} rarity scores from ${minScore.toFixed(2)} to ${maxScore.toFixed(2)}`);
  }
  
  /**
   * Initialize the NFT Beater program state
   */
  async initialize(): Promise<void> {
    if (!this.rarityProgram) {
      throw new Error("Rarity program not initialized");
    }
    
    console.log('Initializing NFT Beater state...');
    
    try {
      // Find the PDA for this merkle tree
      const [rarityState] = await PublicKey.findProgramAddress(
        [
          Buffer.from('nft-beater'),
          this.merkleTreePubkey.toBuffer(),
        ],
        NFTING_PROGRAM_ID
      );
      
      // Default rarity thresholds
      const rarityThresholds = [50, 75, 90]; // Common, Rare, Legendary
      
      await this.rarityProgram.methods
        .initialize(this.merkleTreePubkey, Buffer.from(rarityThresholds))
        .accounts({
          state: rarityState,
          merkleTreeAccount: this.merkleTreePubkey,
          authority: this.wallet.publicKey,
          feeReceiver: new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
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
   * Store all calculated rarity scores on-chain
   */
  async updateOnChainRarityData(): Promise<void> {
    if (!this.rarityProgram) {
      throw new Error("Rarity program not initialized");
    }
    
    if (this.rarityScores.size === 0) {
      throw new Error("No rarity scores calculated. Run indexAllMetadata first.");
    }
    
    console.log('Updating on-chain rarity data...');
    
    // Ensure state is initialized
    await this.initialize();
    
    // Find the PDA for this merkle tree
    const [rarityState] = await PublicKey.findProgramAddress(
      [
        Buffer.from('nft-beater'),
        this.merkleTreePubkey.toBuffer(),
      ],
      NFTING_PROGRAM_ID
    );
    
    // Convert rarity scores to sequential array
    // Make sure all indices from 0 to max are accounted for
    const maxIndex = Math.max(...this.rarityScores.keys());
    const rarityData: number[] = Array(maxIndex + 1).fill(0);
    
    // Fill in the scores we have
    this.rarityScores.forEach((score, index) => {
      rarityData[index] = Math.floor(score);
    });
    
    // Update data in chunks to stay within transaction size limits
    const chunkSize = 50;
    for (let i = 0; i < rarityData.length; i += chunkSize) {
      const chunk = rarityData.slice(i, i + chunkSize);
      
      try {
        await this.rarityProgram.methods
          .updateRarityData(new BN(i), Buffer.from(chunk))
          .accounts({
            state: rarityState,
            authority: this.wallet.publicKey,
            feeReceiver: new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
            systemProgram: SystemProgram.programId,
          })
          .signers([this.wallet])
          .rpc();
        
        console.log(`Updated rarity data for indices ${i} to ${i + chunk.length - 1}`);
      } catch (error) {
        console.error(`Error updating rarity data for chunk ${i}:`, error);
        throw error;
      }
      
      // Add delay between chunks
      if (i + chunkSize < rarityData.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('Rarity data updated on-chain successfully');
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
   * Save rarity data to a JSON file
   */
  saveRarityData(filePath: string): void {
    const data = {
      totalNFTs: this.totalIndexed,
      rarityScores: Array.from(this.rarityScores.entries()).map(([index, score]) => ({
        index,
        score,
        metadata: this.metadataByIndex.get(index),
      })),
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Rarity data saved to ${filePath}`);
  }
}

// Update the main function to offer the bubblegum-style approach as an option
async function main() {
  // Use a high-performance RPC endpoint
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  // Load your wallet from a keypair file
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(
      path.resolve(process.env.KEYPAIR_PATH || '/Users/jarettdunn/ddgb.json'), 
      'utf-8'
    )))
  );
  
  // Command-line arguments
  const command = process.argv[2] || 'mint';
  
  if (command === 'index-rarities') {
    // Use the rarity indexer to calculate and store rarities
    console.log("Starting to index NFT collection and calculate rarities...");
    
    const merkleTreePubkey = new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
    const indexer = new MenagerieRarityIndexer(connection, wallet, merkleTreePubkey);
    
    // Index a sample of the collection (adjust count as needed)
    const totalToIndex = parseInt(process.argv[3] || '100');
    await indexer.indexAllMetadata(totalToIndex);
    
    // Save rarity data to file
    indexer.saveRarityData('menagerie-rarities.json');
    
    // Update on-chain rarity data
    await indexer.updateOnChainRarityData();
    
    console.log("Rarity indexing complete!");
    return;
  }
  
  // Default: Mint an NFT
  const nftIndex = parseInt(process.argv[3] || '4489');
  const useBubblegumSdk = true;
  
  // Create the minter
  const minter = new MenagerieMinter(
    connection, 
    wallet,
    {
      // Uncomment to enable JITO integration
      // jitoEndpoint: "https://jito-relayer-mainnet.block-engine.jito.wtf"
    }
  );
  
  try {
    console.log(`Preparing to mint NFT with index: ${nftIndex}`);
    console.log(`Wallet address: ${wallet.publicKey.toString()}`);
    console.log(`Using approach: ${useBubblegumSdk ? 'Bubblegum SDK' : 'Manual account structure'}`);
    
    // Mint the NFT using the selected approach
    const result = useBubblegumSdk
      ? await minter.mintNFTWithBubblegumSdk(nftIndex, {
          skipPreflight: true,
          minRarityPercentage: 20
        })
      : await minter.mintNFT(nftIndex, {
          computeUnits: 525_000,
          computeUnitPrice: 58767,
          skipPreflight: true,
          minRarityPercentage: 20
        });
    
    console.log("Transaction sent successfully!");
    console.log("Signature:", result.signature);
    console.log("View on Solana Explorer:", `https://explorer.solana.com/tx/${result.signature}`);
    
    // Verify the token account for the new NFT
    const tokenAccount = PublicKey.findProgramAddressSync(
      [
        wallet.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        result.nftMint.toBuffer()
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
    console.log("Token Account (ATA):", tokenAccount.toString());

    // Optionally wait for confirmation
    console.log("Waiting for transaction confirmation...");
    try {
      const confirmation = await connection.confirmTransaction(result.signature, 'confirmed');
      if (confirmation.value.err) {
        console.error("Transaction confirmed but has errors:", confirmation.value.err);
      } else {
        console.log("Menagerie NFT minted and confirmed successfully!");
        
        // Try to get the NFT token data 
        console.log("Fetching on-chain NFT data...");
        try {
          const nftMetadata = await connection.getAccountInfo(
            PublicKey.findProgramAddressSync(
              [
                Buffer.from('metadata'),
                METADATA_PROGRAM_ID.toBuffer(),
                result.nftMint.toBuffer()
              ],
              METADATA_PROGRAM_ID
            )[0]
          );
          
          if (nftMetadata) {
            console.log("NFT metadata found on-chain");
          }
        } catch (metadataError) {
          console.warn("Could not fetch NFT metadata:", metadataError);
        }
      }
    } catch (confirmError) {
      console.warn("Could not confirm transaction, but it might still succeed:", confirmError);
    }
  } catch (error) {
    console.error("Error:", error);
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
