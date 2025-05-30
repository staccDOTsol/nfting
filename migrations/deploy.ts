import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_SLOT_HASHES_PUBKEY,
  TransactionStatus,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  clusterApiUrl,
  TransactionMessage,
  VersionedTransaction,
  VersionedMessage,
} from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
const idl = require('../target/idl/nfting.json');
import { NFTING_PROGRAM_ID, RARITY_TIERS } from './constants';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner, transactionBuilder, publicKey, some, signerIdentity, signerPayer, createSignerFromKeypair, keypairIdentity } from '@metaplex-foundation/umi';
import { fetchCandyMachine, mintV2, mplCandyMachine, safeFetchCandyGuard } from "@metaplex-foundation/mpl-candy-machine";
import { findTokenRecordPda, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import bs58 from 'bs58';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

// Class for handling JITO bundle submissions with rarity-based candy machine mints
export class JitoBundler {
  private connection: Connection;
  private wallet: Keypair;
  private program: Program;
  
  constructor(
    connection: Connection,
    wallet: Keypair,
    endpoint: string, // JITO relayer endpoint
    jitoRegion: "mainnet" | "amsterdam" | "frankfurt" | "ny" | "tokyo" = "mainnet"
  ) {
    this.connection = connection;
    this.wallet = wallet;
    
    // Set up anchor program
    const provider = new AnchorProvider(
      connection,
      { publicKey: wallet.publicKey, signTransaction: async tx => tx, signAllTransactions: async txs => txs },
      { commitment: 'confirmed' }
    );
    
    // @ts-ignore
    this.program = new Program(idl as any,new PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb"), provider);
  }
  
  /**
   * Create and submit a transaction bundle for a candy machine mint with rarity check
   */
  async createAndSubmitBundle(
    candyMachineId: PublicKey,
    rarityStatePDA: PublicKey,
    minRarityThreshold: number
  ): Promise<string> {
    console.log(`Creating bundle for candy machine ${candyMachineId.toString()} with min rarity ${minRarityThreshold}`);
    const umi = createUmi(this.connection.rpcEndpoint)
    .use(keypairIdentity({ publicKey: publicKey(this.wallet.publicKey.toBase58()), secretKey: this.wallet.secretKey }))
    .use(mplCandyMachine())
    .use(mplTokenMetadata());

  // Fetch the Candy Machine
  const candyMachine = await fetchCandyMachine(umi, publicKey(candyMachineId));
  const candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);

  // Generate mint signer
  const nftMint = generateSigner(umi);
  
  // Create mint transaction
  const transaction = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      mintV2(umi, {
        candyMachine: candyMachine.publicKey,
        candyGuard: candyGuard?.publicKey,
        nftMint,
        tokenRecord: findTokenRecordPda(umi, {mint: nftMint.publicKey, token: publicKey(await getAssociatedTokenAddressSync(new PublicKey(nftMint.publicKey.toString()), this.wallet.publicKey))}),
        group: candyGuard?.groups[0].label,
        collectionMint: candyMachine.collectionMint,
        collectionUpdateAuthority: candyMachine.authority,
        mintArgs: {},
      })
    );

  // Build and serialize the Umi transaction
  const built = await transaction.buildWithLatestBlockhash(umi);
  const decompiled = TransactionMessage.decompile(VersionedMessage.deserialize(built.serializedMessage));
  console.log(decompiled.instructions);
  decompiled.instructions[decompiled.instructions.length-1].keys.push({pubkey:new PublicKey("CVkDzSp18UpKzhTtryrtHg14VN5QrxuYhrUMjbwQ4z9G"), isSigner:false, isWritable:true})  // Create Solana transaction
  const tx = new Transaction().add(...decompiled.instructions);
  // Add validate mint instruction
  tx.add(await this.program.methods
    .validateMint(minRarityThreshold)
    .accounts({
      feeReceiver: new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
      state: rarityStatePDA,
      candyMachine: candyMachineId,
      recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
      minter: this.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction());
    tx.recentBlockhash = built.message.blockhash;
    tx.feePayer = this.wallet.publicKey;
    tx.partialSign( Keypair.fromSecretKey (nftMint.secretKey));
    tx.partialSign(this.wallet);
    try {
      const signature = await this.connection.sendRawTransaction(tx.serialize());
      return signature;
    } catch (error) {
      console.log(error);
      return ""
    }

  }
  
  /**
   * Create a transaction to validate NFT rarity before minting
   */
  
  /**
   * Create a transaction to mint an NFT from the candy machine
   * Note: This is a simplified version. In a real implementation, you'd use
   * the Metaplex SDK to create the actual mint transaction
   */
  async createCandyMachineMintTransaction(
    candyMachineAddress: PublicKey,
    nftBeaterAddress: PublicKey,
    minRarityPercentage: number = 0
  ): Promise<Transaction> {
    // Create Umi instance
    const umi = createUmi(this.connection.rpcEndpoint)
      .use(keypairIdentity({ publicKey: publicKey(this.wallet.publicKey.toBase58()), secretKey: this.wallet.secretKey }))
      .use(mplCandyMachine())
      .use(mplTokenMetadata());

    // Fetch the Candy Machine
    const candyMachine = await fetchCandyMachine(umi, publicKey(candyMachineAddress));
    const candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);

    // Generate mint signer
    const nftMint = generateSigner(umi);
    
    // Create mint transaction
    const transaction = await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 800_000 }))
      .add(
        mintV2(umi, {
          candyMachine: candyMachine.publicKey,
          candyGuard: candyGuard?.publicKey,
          nftMint,
          collectionMint: candyMachine.collectionMint,
          collectionUpdateAuthority: candyMachine.authority,
          mintArgs: {},
        })
      );

    // Build and serialize the Umi transaction
    const built = await transaction.buildWithLatestBlockhash(umi);
    const decompiled = TransactionMessage.decompile(VersionedMessage.deserialize(built.serializedMessage));
    
    // Create Solana transaction
    const tx = new Transaction(new TransactionMessage({
      payerKey: this.wallet.publicKey,
      recentBlockhash: built.message.blockhash,
      instructions: decompiled.instructions,
    }));

    tx.instructions[tx.instructions.length-1].keys.push({pubkey:new PublicKey("CVkDzSp18UpKzhTtryrtHg14VN5QrxuYhrUMjbwQ4z9G"), isSigner:false, isWritable:true})
    // Add validate mint instruction
    tx.add(await this.program.methods
      .validateMint(minRarityPercentage)
      .accounts({
        feeReceiver: new PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
        state: nftBeaterAddress,
        candyMachine: candyMachineAddress,
        recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
        minter: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction());

    return tx;
  }
  
  /**
   * Wait for a bundle to be confirmed
   */
  private async waitForBundleConfirmation(
    bundleId: string,
    lastValidBlockHeight: number
  ): Promise<void> {
    let currentBlockHeight = await this.connection.getBlockHeight();
    let confirmed = false;
    
    console.log(`Waiting for bundle ${bundleId} to be confirmed...`);
    
    while (currentBlockHeight <= lastValidBlockHeight && !confirmed) {
      try {
        // Check if the bundle has been confirmed

      } catch (error) {
        console.error('Error checking bundle status:', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentBlockHeight = await this.connection.getBlockHeight();
      }
    }
    
    if (!confirmed) {
      throw new Error(`Bundle ${bundleId} was not confirmed within the validity window`);
    }
  }
  
  /**
   * Static method to derive the rarity state PDA for a candy machine
   */
  static async getRarityStatePDA(
    candyMachineId: PublicKey,
  ): Promise<PublicKey> {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nft-beater"), candyMachineId.toBuffer()],
      NFTING_PROGRAM_ID
    );
    
    return pda;
  }

}

/**
 * Example usage
 */
async function main() {
  // Set up a connection to the Solana cluster
  const connection = new Connection('https://', 'confirmed');
  
  // Load your wallet from a keypair file
  const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(require('fs').readFileSync('/Users/jarettdunn/new.json'))));
  
  // Candy machine ID you want to mint from
  const candyMachineId = new PublicKey(process.env.CANDY_MACHINE_ID || 'YourCandyMachineIdHere');
  
  const bundler = new JitoBundler(
    connection,
    wallet,
    'https://jito-relayer-mainnet.block-engine.jito.wtf'
  );
  
  try {
    // Get the rarity state PDA for this candy machine
    const rarityStatePDA = await JitoBundler.getRarityStatePDA(candyMachineId);
    
    // Create array of 128 concurrent mint attempts
    const mintPromises = Array(256).fill(null).map(() => 
      bundler.createAndSubmitBundle(
        candyMachineId,
        rarityStatePDA,
        4
      ).catch(error => {
        console.error('Mint attempt failed:', error);
        return null;
      })
    );

    // Run all attempts concurrently
    const results = await Promise.all(mintPromises);
    
    // Filter out failed attempts and log successful ones
    const successfulMints = results.filter(sig => sig !== '');
    console.log(`Successfully minted ${successfulMints.length} NFTs`);
    console.log('Signatures:', successfulMints);
  } catch (error) {
    console.error('Error in minting process:', error);
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