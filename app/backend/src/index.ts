import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import logger, { loggerStream } from './utils/logger';
import cacheService from './services/cache';

// Import routes
import collectionsRouter from './api/routes/collections';
import rarityRouter from './api/routes/rarity';

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.api.rateLimitWindowMs,
  max: config.api.rateLimitMaxRequests,
  message: 'Too many requests, please try again later.',
});
app.use('/api/', limiter);

// Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/collections', collectionsRouter);
app.use('/api/rarity', rarityRouter);

// Cache stats endpoint
app.get('/api/stats/cache', async (req, res) => {
  try {
    const stats = await cacheService.getCacheStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: config.server.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function start() {
  try {
    // Connect to Redis
    await cacheService.connect();
    logger.info('Connected to Redis');
    
    // Start Express server
    const server = app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port} in ${config.server.nodeEnv} mode`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
      });
      
      // Disconnect from Redis
      await cacheService.disconnect();
      
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
      });
      
      // Disconnect from Redis
      await cacheService.disconnect();
      
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
start(); 