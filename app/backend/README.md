# NFTing Backend Service

Backend service for indexing NFT rarities and enabling assured rarity minting on Solana.

## Overview

This backend service provides:
- NFT metadata indexing from IPFS
- Rarity score calculation based on attributes
- Redis caching for fast access
- Transaction generation for on-chain operations
- RESTful API for frontend integration

## Prerequisites

- Node.js 18+
- Redis server
- pnpm package manager
- Solana wallet with SOL for fees

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp env.example .env

# Edit .env with your configuration
```

## Configuration

Edit `.env` file with your settings:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
PROGRAM_ID=14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# IPFS Gateway
IPFS_GATEWAY=https://gateway.pinit.io/ipfs/

# Fee Configuration
FEE_RECEIVER=89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY
```

## Running the Service

```bash
# Development mode
pnpm dev

# Production build
pnpm build
pnpm start
```

## API Endpoints

### Collections

**Get Collection Info**
```
GET /api/collections/:address
```

**Initialize Collection Transaction**
```
POST /api/collections/initialize-transaction
Body: {
  walletAddress: string,
  collectionAddress: string,
  rarityThresholds: number[]
}
```

**Index Collection**
```
POST /api/collections/index
Body: {
  collectionAddress: string,
  ipfsHash: string,
  totalSupply: number
}
```

**Get Indexing Progress**
```
GET /api/collections/:address/indexing-progress
```

### Rarity

**Check Rarity**
```
POST /api/rarity/check
Body: {
  collectionAddress: string,
  indices?: number[],
  minRarity?: number
}
```

**Get Sync Transaction**
```
POST /api/rarity/sync-transaction
Body: {
  walletAddress: string,
  collectionAddress: string,
  batchSize?: number
}
```

**Get Rarity Distribution**
```
GET /api/rarity/:collectionAddress/distribution
```

### Stats

**Get Cache Stats**
```
GET /api/stats/cache
```

## Architecture

### Services

- **CacheService**: Redis caching for metadata and rarity data
- **SolanaService**: Transaction generation and on-chain interactions
- **IndexingService**: IPFS metadata fetching and rarity calculation

### Rarity Calculation

Rarity scores are calculated based on attribute frequency:
1. Count occurrences of each attribute value
2. Calculate frequency (occurrences / total supply)
3. Rarity score = (1 - frequency) * 100
4. Average across all attributes

### Data Flow

1. User adds collection via frontend
2. Backend generates initialize transaction
3. User signs and sends transaction
4. Backend indexes metadata from IPFS
5. Rarity scores calculated and cached
6. User can sync rarity data on-chain
7. Users can mint with rarity verification

## Development

### Project Structure

```
src/
├── api/
│   └── routes/
│       ├── collections.ts
│       └── rarity.ts
├── config/
│   └── index.ts
├── services/
│   ├── cache.ts
│   ├── solana.ts
│   └── indexing.ts
├── types/
│   └── index.ts
├── utils/
│   └── logger.ts
└── index.ts
```

### Adding New Features

1. Add types to `src/types/index.ts`
2. Create service in `src/services/`
3. Add API routes in `src/api/routes/`
4. Update documentation

## Deployment

### Using PM2

```bash
# Build the project
pnpm build

# Start with PM2
pm2 start dist/index.js --name nfting-backend

# Save PM2 configuration
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## Monitoring

- Health check: `GET /health`
- Logs: Check `logs/` directory
- Redis monitoring: Use Redis CLI or GUI tools

## Troubleshooting

### Redis Connection Issues
- Ensure Redis is running: `redis-cli ping`
- Check Redis configuration in `.env`

### IPFS Timeouts
- Try alternative IPFS gateways
- Implement retry logic for failed requests

### Transaction Failures
- Check wallet balance for fees
- Verify program ID is correct
- Ensure collection is properly initialized

## License

MIT 