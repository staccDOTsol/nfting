import { 
  Connection, 
  PublicKey, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction 
} from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import config from '../config';
import logger from '../utils/logger';
import { RarityData } from '../types';

// TODO: Import actual IDL when available
// import idl from '../../../target/idl/nfting.json';

// For now, we'll use a minimal IDL type
const idl = {
  version: "0.1.0",
  name: "nfting",
  instructions: [],
  accounts: [],
  types: []
};

const PROGRAM_ID = new PublicKey(config.solana.programId);
const FEE_RECEIVER = new PublicKey(config.solana.feeReceiver);
const FEE_LAMPORTS = 100_000_000; // 0.1 SOL

export class SolanaService {
  private connection: Connection;
  private umi: any;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    this.umi = createUmi(config.solana.rpcUrl);
  }

  /**
   * Get the latest blockhash
   */
  async getLatestBlockhash() {
    return await this.connection.getLatestBlockhash();
  }

  /**
   * Get the PDA address for a rarity state account
   */
  getRarityStatePDA(merkleTree: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('nft-beater'), merkleTree.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Create initialize instruction for a new collection
   */
  async createInitializeInstruction(
    authority: PublicKey,
    merkleTree: PublicKey,
    rarityThresholds: number[]
  ): Promise<TransactionInstruction> {
    const [statePDA] = this.getRarityStatePDA(merkleTree);
    
    // Create a mock provider just to build the instruction
    const mockWallet = {
      publicKey: authority,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    
    const provider = new AnchorProvider(
      this.connection,
      mockWallet as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program(idl as any, PROGRAM_ID, provider);
    
    const ix = await program.methods
      .initialize(rarityThresholds)
      .accounts({
        state: statePDA,
        merkleTree: merkleTree,
        merkleTreeAccount: merkleTree,
        authority: authority,
        feeReceiver: FEE_RECEIVER,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    return ix;
  }

  /**
   * Create update rarity data instruction
   */
  async createUpdateRarityInstruction(
    authority: PublicKey,
    merkleTree: PublicKey,
    startIndex: number,
    rarityData: number[]
  ): Promise<TransactionInstruction> {
    const [statePDA] = this.getRarityStatePDA(merkleTree);
    
    const mockWallet = {
      publicKey: authority,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    
    const provider = new AnchorProvider(
      this.connection,
      mockWallet as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program(idl as any, PROGRAM_ID, provider);
    
    const ix = await program.methods
      .updateRarityData(new BN(startIndex), Buffer.from(rarityData))
      .accounts({
        state: statePDA,
        authority: authority,
        merkleTree: merkleTree,
        feeReceiver: FEE_RECEIVER,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    return ix;
  }

  /**
   * Create validate mint instruction
   */
  async createValidateMintInstruction(
    minter: PublicKey,
    merkleTree: PublicKey,
    minRarityPercentage: number,
    numMinted: number
  ): Promise<TransactionInstruction> {
    const [statePDA] = this.getRarityStatePDA(merkleTree);
    
    const mockWallet = {
      publicKey: minter,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    
    const provider = new AnchorProvider(
      this.connection,
      mockWallet as any,
      { commitment: 'confirmed' }
    );
    
    const program = new Program(idl as any, PROGRAM_ID, provider);
    
    const ix = await program.methods
      .validateMint(minRarityPercentage, new BN(numMinted))
      .accounts({
        state: statePDA,
        merkleTree: merkleTree,
        minter: minter,
        feeReceiver: FEE_RECEIVER,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    return ix;
  }

  /**
   * Check if a rarity state is initialized for a collection
   */
  async isCollectionInitialized(merkleTree: PublicKey): Promise<boolean> {
    try {
      const [statePDA] = this.getRarityStatePDA(merkleTree);
      const accountInfo = await this.connection.getAccountInfo(statePDA);
      return accountInfo !== null;
    } catch (error) {
      logger.error('Error checking collection initialization:', error);
      return false;
    }
  }

  /**
   * Get on-chain rarity state for a collection
   */
  async getOnChainRarityState(merkleTree: PublicKey): Promise<any | null> {
    try {
      const [statePDA] = this.getRarityStatePDA(merkleTree);
      
      const mockWallet = {
        publicKey: PublicKey.default,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
      };
      
      const provider = new AnchorProvider(
        this.connection,
        mockWallet as any,
        { commitment: 'confirmed' }
      );
      
      const program = new Program(idl as any, PROGRAM_ID, provider);
      
      const state = await program.account.rarityState.fetch(statePDA);
      return state;
    } catch (error) {
      logger.error('Error fetching on-chain rarity state:', error);
      return null;
    }
  }

  /**
   * Get current number minted for a merkle tree
   */
  async getNumMinted(merkleTree: PublicKey): Promise<number | null> {
    try {
      // This would need to fetch from the actual tree config account
      // For now, returning null as it requires specific knowledge of the tree structure
      logger.warn('getNumMinted not fully implemented - requires tree config parsing');
      return null;
    } catch (error) {
      logger.error('Error getting num minted:', error);
      return null;
    }
  }

  /**
   * Create a transaction with multiple update instructions
   */
  async createBatchUpdateTransaction(
    authority: PublicKey,
    merkleTree: PublicKey,
    rarityDataBatches: Array<{ startIndex: number; data: number[] }>
  ): Promise<Transaction> {
    const transaction = new Transaction();
    
    for (const batch of rarityDataBatches) {
      const ix = await this.createUpdateRarityInstruction(
        authority,
        merkleTree,
        batch.startIndex,
        batch.data
      );
      transaction.add(ix);
    }
    
    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authority;
    
    return transaction;
  }

  /**
   * Helper to estimate transaction fees
   */
  async estimateTransactionFee(transaction: Transaction): Promise<number> {
    try {
      const message = transaction.compileMessage();
      const fee = await this.connection.getFeeForMessage(message);
      return fee.value || 5000; // Default to 5000 lamports if estimation fails
    } catch (error) {
      logger.error('Error estimating transaction fee:', error);
      return 5000;
    }
  }

  /**
   * Validate that required accounts exist
   */
  async validateAccounts(accounts: PublicKey[]): Promise<boolean> {
    try {
      const accountInfos = await this.connection.getMultipleAccountsInfo(accounts);
      return accountInfos.every(info => info !== null);
    } catch (error) {
      logger.error('Error validating accounts:', error);
      return false;
    }
  }
}

export const solanaService = new SolanaService();
export default solanaService; 