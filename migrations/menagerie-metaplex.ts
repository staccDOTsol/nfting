import {
  createUmi,
  generateSigner,
  keypairIdentity,
  publicKey,
  some,
  Umi,
  transactionBuilder
} from '@metaplex-foundation/umi';
import {
  mplBubblegum,
  mintToCollectionV1,
  MetadataArgs,
  getLeafSchemaSerializer,
} from '@metaplex-foundation/mpl-bubblegum';
import { createUmi as createUmiWithDefaults } from '@metaplex-foundation/umi-bundle-defaults';
import { PublicKey, Keypair, Connection, TransactionMessage, VersionedMessage, VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Custom addresses and program IDs
const MENAGERIE_PROGRAM_ID = new PublicKey("F9SixdqdmEBP5kprp2gZPZNeMmfHJRCTMFjN22dx3akf");
const BUBBLEGUM_PROGRAM_ID = new PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");
const COMPRESSION_PROGRAM_ID = new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
const MERKLE_TREE_ADDRESS = new PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
const COLLECTION_MINT = new PublicKey("CXbixcWqWyCiwxhHqMPbveQUjeL9r4H3RUZd9LFKcBhe");

// IPFS metadata URI for Menagerie NFTs
const IPFS_METADATA_BASE_URI = "https://gateway.pinit.io/ipfs/Qmd2mt5hpF9d9QMDhpX9SecoPsvdpqcGVnP7ETfxB6hrr3";

// Interface for NFT metadata
interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/**
 * Class for minting Menagerie NFTs using Metaplex SDK
 */
export class MenagerieMetaplexMinter {
  private umi: Umi;
  private connection: Connection;
  private wallet: Keypair;
  
  constructor(connection: Connection, wallet: Keypair) {
    this.connection = connection;
    this.wallet = wallet;
    
    // Initialize UMI with default plugins
    this.umi = createUmiWithDefaults(connection.rpcEndpoint)
      .use(mplBubblegum());
    
    // Use our wallet identity
    const umiKeypair = {
      publicKey: publicKey(wallet.publicKey.toBase58()),
      secretKey: wallet.secretKey,
    };
    this.umi.use(keypairIdentity(umiKeypair));
    
    console.log("Menagerie Metaplex minter initialized with wallet:", wallet.publicKey.toBase58());
  }
  
  /**
   * Fetch NFT metadata from IPFS
   */
  private async fetchNFTMetadata(index: number): Promise<NFTMetadata | null> {
    try {
      const uri = `${IPFS_METADATA_BASE_URI}/${index}.json`;
      console.log(`Fetching metadata for NFT #${index} from ${uri}`);
      const response = await axios.get(uri);
      return response.data;
    } catch (error) {
      console.error(`Error fetching metadata for index ${index}:`, error);
      return null;
    }
  }
  
  /**
   * Convert standard NFT metadata to Bubblegum metadata args
   */
  private async createMetadataArgs(index: number): Promise<MetadataArgs> {
    // Try to fetch real metadata, or use placeholder if not available
    const metadata = await this.fetchNFTMetadata(index) || {
      name: `Menagerie #${index}`,
      symbol: "MNGR",
      description: "Menagerie NFT Collection",
      image: `${IPFS_METADATA_BASE_URI}/${index}.png`,
      attributes: []
    };
    
    // Convert to Bubblegum format
    return {
      name: metadata.name,
      symbol: metadata.symbol || "MNGR",
      uri: `${IPFS_METADATA_BASE_URI}/${index}.json`,
      sellerFeeBasisPoints: 550, // 5.5%
      creators: [],
      collection: some({ key: publicKey(COLLECTION_MINT.toBase58()), verified: false }),
      uses: null,
      // Required fields for MetadataArgs
      primarySaleHappened: false,
      isMutable: true,
      editionNonce: some(0),
      tokenStandard: some(0), // NonFungible standard
      tokenProgramVersion: 0, // Token Program v0
    };
  }
  
  /**
   * Mint a new NFT using Metaplex SDK but targeting Menagerie program
   */
  async mintNFT(index: number, options?: { dryRun?: boolean }): Promise<string> {
    console.log(`Minting Menagerie NFT #${index} using Metaplex SDK...`);
    
    // Generate metadata args
    const metadata = await this.createMetadataArgs(index);
    
    // Setup leaf owner (our wallet)
    const leafOwner = publicKey(this.wallet.publicKey.toBase58());
    const merkleTree = publicKey(MERKLE_TREE_ADDRESS.toBase58());
    const collectionMint = publicKey(COLLECTION_MINT.toBase58());
    
    // Optional: Generate a NFT mint keypair (Menagerie seems to need this even for compressed NFTs)
    const nftMint = generateSigner(this.umi);
    
    console.log("Creating mint transaction with:", {
      leafOwner: leafOwner.toString(),
      merkleTree: merkleTree.toString(),
      collectionMint: collectionMint.toString(),
      nftMint: nftMint.publicKey.toString(),
    });
    
    // Create the transaction using Metaplex SDK's mintToCollectionV1
    let transaction = mintToCollectionV1(this.umi, {
      leafOwner,
      merkleTree,
      metadata,
      collectionMint,
      collectionAuthority: this.umi.identity,
      payer: this.umi.payer,
      treeCreatorOrDelegate: this.umi.identity,
    });
    
    // CRITICAL: Replace the Bubblegum program ID with the Menagerie program ID
    // Get the built transaction instructions
    const builtTransaction = await transaction.buildWithLatestBlockhash(this.umi);
    const serializedMessage =VersionedMessage.deserialize(await builtTransaction.serializedMessage);
    const deserializedMessage = TransactionMessage.decompile(serializedMessage);
    const instructions = deserializedMessage.instructions;  
    // Replace each occurrence of BUBBLEGUM_PROGRAM_ID with MENAGERIE_PROGRAM_ID in the transaction
    instructions.forEach(ix => {
      if (ix.programId.toString() === BUBBLEGUM_PROGRAM_ID.toString()) {
        // Extract the first 8 bytes of the instruction data
        // This is typically the instruction discriminator
        const instructionDiscriminator = ix.data.slice(0, 8);
        
        // Log the original discriminator for debugging
        console.log("Original instruction discriminator:", Buffer.from(instructionDiscriminator).toString('hex'));
        
        // Replace with the Menagerie discriminator: first 8 bytes of "2BvDMbV1NAs8gTrjJNggXr979mMGFt6bTnz6Nh6"
        const menagerieDiscriminator = Buffer.from("738715186c2d5fe40000000080b2e60e000000000100000000010001", "hex").slice(0, 8);
        
        // Replace the discriminator in the instruction data
        for (let i = 0; i < 8; i++) {
          ix.data[i] = menagerieDiscriminator[i];
        }
        ix.data = Buffer.from("738715186c2d5fe40000000080b2e60e000000000100000000010001", "hex");
        
        console.log("Modified instruction discriminator:", Buffer.from(ix.data.slice(0, 8)).toString('hex'));
        
        // Insert key 0 into key 2 position, shifting current key 2 to position 3
        if (ix.keys.length >= 3) {
          ix.keys.splice(0, 0, {pubkey: this.wallet.publicKey, isSigner: true, isWritable: true});
          console.log("Inserted key 0 into position 2, shifted original key 2 to position 3");
        }
        
        ix.programId = MENAGERIE_PROGRAM_ID;
        console.log("Replaced Bubblegum program ID with Menagerie program ID");
      }
    });
    
    console.log(instructions  )
    const modifiedMessage = new TransactionMessage({instructions: instructions, payerKey: this.wallet.publicKey, recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash});
    const modifiedTransaction = new VersionedTransaction(modifiedMessage.compileToV0Message());
    // For debugging
    console.log("Transaction has been modified to target Menagerie program");
    
    try {
      if (options?.dryRun) {
        console.log("Dry run - transaction not sent");
        // Get the serialized transaction for inspection
        const serialized = await modifiedTransaction.serialize();
        console.log("Transaction serialized for dry run inspection");
        return "DRY_RUN";
      }
      
      // Send the modified transaction
      console.log("Sending transaction to Menagerie program...");
      modifiedTransaction.message.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      modifiedTransaction.sign([this.wallet]);
      console.log(modifiedTransaction)
      const result = await this.connection.sendRawTransaction(modifiedTransaction.serialize(), {skipPreflight:true});
      console.log("Transaction sent successfully!");
      const signature = result.toString();
      console.log("Signature:", signature);
      
      return signature;
    } catch (error) {
      console.error("Error minting NFT:", error);
      throw error;
    }
  }
  
  /**
   * Create a custom mint instruction directly targeting the Menagerie program
   * This is an alternative approach if the modified SDK approach doesn't work
   */
  async mintNFTCustom(index: number): Promise<string> {
    console.log(`Minting Menagerie NFT #${index} using custom approach...`);
    
    // Generate metadata args 
    const metadata = await this.createMetadataArgs(index);
    
    // Create leaf owner (our wallet)
    const leafOwner = publicKey(this.wallet.publicKey.toBase58());
    const merkleTree = publicKey(MERKLE_TREE_ADDRESS.toBase58());
    
    // Create a custom transaction builder with MENAGERIE_PROGRAM_ID
    // ... implement custom transaction builder ...
    
    // This would be a more complex implementation, requiring us to:
    // 1. Format the instruction data exactly as Menagerie expects
    // 2. Include all required accounts in the right order
    // 3. Handle signature correctly
    
    return "NOT_IMPLEMENTED";
  }
}

// Main function to run the minter
async function main() {
  // Parse command line arguments
  const command = process.argv[2] || 'mint';
  const nftIndex = parseInt(process.argv[3] || '0');
  const dryRun = process.argv.includes('--dry-run');
  
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
  
  // Create minter
  const minter = new MenagerieMetaplexMinter(connection, wallet);
  
  if (command === 'mint') {
    console.log(`Minting NFT with index: ${nftIndex} (Dry run: ${dryRun})`);
    
    try {
      const signature = await minter.mintNFT(nftIndex, { dryRun });
      
      console.log("Operation completed successfully!");
      console.log(dryRun ? "Dry run completed" : `View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    console.log("Available commands: mint");
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
} 