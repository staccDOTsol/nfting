import { Router, Request, Response } from 'express';
import { PublicKey, Transaction } from '@solana/web3.js';
import Joi from 'joi';
import solanaService from '../../services/solana';
import cacheService from '../../services/cache';
import indexingService from '../../services/indexing';
import logger from '../../utils/logger';

const router = Router();

// Validation schemas
const initializeSchema = Joi.object({
  walletAddress: Joi.string().required(),
  collectionAddress: Joi.string().required(),
  rarityThresholds: Joi.array().items(Joi.number().min(0).max(100)).default([50, 75, 90]),
});

const indexCollectionSchema = Joi.object({
  collectionAddress: Joi.string().required(),
  ipfsHash: Joi.string().required(),
  totalSupply: Joi.number().integer().min(1).required(),
});

/**
 * Get collection info
 */
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    const collectionInfo = await cacheService.getCollectionInfo(address);
    if (!collectionInfo) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    const isOnChainInitialized = await solanaService.isCollectionInitialized(
      new PublicKey(address)
    );
    
    const indexingProgress = await indexingService.getIndexingProgress(address);
    
    res.json({
      ...collectionInfo,
      isOnChainInitialized,
      indexingProgress,
    });
  } catch (error) {
    logger.error('Error getting collection info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get transaction to initialize collection on-chain
 */
router.post('/initialize-transaction', async (req: Request, res: Response) => {
  try {
    const { error, value } = initializeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { walletAddress, collectionAddress, rarityThresholds } = value;
    
    // Check if already initialized
    const isInitialized = await solanaService.isCollectionInitialized(
      new PublicKey(collectionAddress)
    );
    
    if (isInitialized) {
      return res.status(400).json({ error: 'Collection already initialized' });
    }
    
    // Create initialize instruction
    const instruction = await solanaService.createInitializeInstruction(
      new PublicKey(walletAddress),
      new PublicKey(collectionAddress),
      rarityThresholds
    );
    
    // Create transaction
    const transaction = new Transaction().add(instruction);
    const { blockhash } = await solanaService.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(walletAddress);
    
    // Serialize for client
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    
    res.json({
      transaction: serialized.toString('base64'),
      message: 'Sign and send this transaction to initialize the collection',
    });
  } catch (error) {
    logger.error('Error creating initialize transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Index a collection's metadata
 */
router.post('/index', async (req: Request, res: Response) => {
  try {
    const { error, value } = indexCollectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { collectionAddress, ipfsHash, totalSupply } = value;
    
    // Start indexing in background
    indexingService.indexCollection(
      collectionAddress,
      ipfsHash,
      totalSupply
    ).catch(err => {
      logger.error('Background indexing failed:', err);
    });
    
    res.json({
      message: 'Indexing started',
      estimatedTime: `${Math.ceil(totalSupply / 50) * 0.5} seconds`,
    });
  } catch (error) {
    logger.error('Error starting indexing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get indexing progress
 */
router.get('/:address/indexing-progress', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const progress = await indexingService.getIndexingProgress(address);
    res.json(progress);
  } catch (error) {
    logger.error('Error getting indexing progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 