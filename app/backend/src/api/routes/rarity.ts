import { Router, Request, Response } from 'express';
import { PublicKey, Transaction } from '@solana/web3.js';
import Joi from 'joi';
import solanaService from '../../services/solana';
import cacheService from '../../services/cache';
import logger from '../../utils/logger';
import { RarityCheckRequest } from '../../types';

const router = Router();

// Validation schemas
const checkRaritySchema = Joi.object({
  collectionAddress: Joi.string().required(),
  indices: Joi.array().items(Joi.number().integer().min(0)).optional(),
  minRarity: Joi.number().min(0).max(100).default(0),
});

const syncRaritySchema = Joi.object({
  walletAddress: Joi.string().required(),
  collectionAddress: Joi.string().required(),
  batchSize: Joi.number().integer().min(1).max(250).default(100),
});

/**
 * Check rarity for specific NFTs or all NFTs in a collection
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { error, value } = checkRaritySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { collectionAddress, indices, minRarity = 0 } = value as RarityCheckRequest;
    
    // Get collection info
    const collectionInfo = await cacheService.getCollectionInfo(collectionAddress);
    if (!collectionInfo) {
      return res.status(404).json({ error: 'Collection not found. Please index it first.' });
    }
    
    // If no indices specified, search by rarity
    if (!indices || indices.length === 0) {
      const eligibleRarities = await cacheService.searchByRarity(
        collectionAddress,
        minRarity,
        100,
        100 // Limit to 100 results
      );
      
      // Fetch metadata for eligible NFTs
      const eligible = await Promise.all(
        eligibleRarities.map(async (rarity) => {
          const metadata = await cacheService.getNFTMetadata(collectionAddress, rarity.index);
          return metadata ? { ...metadata, rarity } : null;
        })
      );
      
      return res.json({
        eligible: eligible.filter(Boolean),
        ineligible: [],
        stats: {
          totalChecked: eligibleRarities.length,
          eligibleCount: eligibleRarities.length,
          averageRarity: eligibleRarities.reduce((sum, r) => sum + r.score, 0) / eligibleRarities.length,
        },
      });
    }
    
    // Check specific indices
    const eligible = [];
    const ineligible = [];
    let totalRarity = 0;
    
    for (const index of indices) {
      const metadata = await cacheService.getNFTMetadata(collectionAddress, index);
      const rarity = await cacheService.getRarityData(collectionAddress, index);
      
      if (metadata && rarity) {
        const nftWithRarity = { ...metadata, rarity };
        if (rarity.score >= minRarity) {
          eligible.push(nftWithRarity);
        } else {
          ineligible.push(nftWithRarity);
        }
        totalRarity += rarity.score;
      }
    }
    
    res.json({
      eligible,
      ineligible,
      stats: {
        totalChecked: indices.length,
        eligibleCount: eligible.length,
        averageRarity: indices.length > 0 ? totalRarity / indices.length : 0,
      },
    });
  } catch (error) {
    logger.error('Error checking rarity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get transaction to sync rarity data on-chain
 */
router.post('/sync-transaction', async (req: Request, res: Response) => {
  try {
    const { error, value } = syncRaritySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { walletAddress, collectionAddress, batchSize } = value;
    
    // Check if collection is initialized on-chain
    const isInitialized = await solanaService.isCollectionInitialized(
      new PublicKey(collectionAddress)
    );
    
    if (!isInitialized) {
      return res.status(400).json({ 
        error: 'Collection not initialized on-chain. Please initialize it first.' 
      });
    }
    
    // Get rarity map from cache
    const rarityMap = await cacheService.getRarityMap(collectionAddress);
    if (rarityMap.length === 0) {
      return res.status(400).json({ 
        error: 'No rarity data found. Please index the collection first.' 
      });
    }
    
    // Create batches
    const batches = [];
    for (let i = 0; i < rarityMap.length; i += batchSize) {
      const data = rarityMap.slice(i, i + batchSize);
      if (data.length > 0) {
        batches.push({ startIndex: i, data });
      }
    }
    
    // Create transaction with batch updates
    const transaction = await solanaService.createBatchUpdateTransaction(
      new PublicKey(walletAddress),
      new PublicKey(collectionAddress),
      batches
    );
    
    // Estimate fees
    const estimatedFee = await solanaService.estimateTransactionFee(transaction);
    
    // Serialize for client
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    
    res.json({
      transaction: serialized.toString('base64'),
      batches: batches.length,
      totalIndices: rarityMap.length,
      estimatedFee: estimatedFee / 1e9, // Convert to SOL
      message: 'Sign and send this transaction to sync rarity data on-chain',
    });
  } catch (error) {
    logger.error('Error creating sync transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get rarity distribution statistics
 */
router.get('/:collectionAddress/distribution', async (req: Request, res: Response) => {
  try {
    const { collectionAddress } = req.params;
    
    const collectionInfo = await cacheService.getCollectionInfo(collectionAddress);
    if (!collectionInfo) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    // Get rarity map
    const rarityMap = await cacheService.getRarityMap(collectionAddress);
    
    // Calculate distribution
    const distribution = {
      '0-25': 0,
      '26-50': 0,
      '51-75': 0,
      '76-90': 0,
      '91-100': 0,
    };
    
    for (const score of rarityMap) {
      if (score <= 25) distribution['0-25']++;
      else if (score <= 50) distribution['26-50']++;
      else if (score <= 75) distribution['51-75']++;
      else if (score <= 90) distribution['76-90']++;
      else distribution['91-100']++;
    }
    
    // Calculate percentages
    const total = rarityMap.length;
    const distributionPercentages = Object.entries(distribution).reduce((acc, [range, count]) => {
      acc[range] = {
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
      return acc;
    }, {} as any);
    
    res.json({
      total: total,
      distribution: distributionPercentages,
      averageRarity: total > 0 ? rarityMap.reduce((sum, r) => sum + r, 0) / total : 0,
      minRarity: Math.min(...rarityMap),
      maxRarity: Math.max(...rarityMap),
    });
  } catch (error) {
    logger.error('Error getting rarity distribution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 