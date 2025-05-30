# NFTing - Assured Rarity NFT Minting Platform

A complete platform for minting Solana NFTs with on-chain rarity verification, ensuring users can mint only NFTs that meet their desired rarity thresholds.

![NFTing Platform](https://via.placeholder.com/800x400?text=NFTing+Platform)

## 🚀 Overview

NFTing revolutionizes NFT minting by providing:
- **On-chain rarity verification** - All rarity data stored on Solana blockchain
- **Pre-mint rarity checking** - Know the rarity before you mint
- **Beautiful modern UI** - Seamless user experience
- **Fast indexing** - Index entire collections in minutes
- **Wallet integration** - Support for popular Solana wallets

## 🏗️ Architecture

The platform consists of three main components:

```
nfting/
├── programs/       # Solana smart contract
├── app/
│   ├── backend/   # Node.js API service  
│   └── frontend/  # Next.js web app
└── scripts/       # Utility scripts
```

### Smart Contract
- Written in Anchor framework
- Stores rarity data on-chain
- Validates mints against rarity thresholds
- Charges 0.1 SOL fee per operation

### Backend Service
- Indexes NFT metadata from IPFS
- Calculates rarity scores
- Caches data in Redis
- Provides REST API

### Frontend Application
- Modern React/Next.js app
- Beautiful UI with Tailwind CSS
- Wallet integration
- Real-time updates

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+
- pnpm
- Redis
- Solana CLI & Anchor
- Phantom/Solflare wallet

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/nfting.git
cd nfting
```

2. **Install dependencies**
```bash
# Install Anchor dependencies
pnpm install

# Install backend dependencies
cd app/backend
pnpm install

# Install frontend dependencies
cd ../frontend
pnpm install
```

3. **Start Redis**
```bash
redis-server
```

4. **Configure environment**
```bash
# Backend
cd app/backend
cp env.example .env
# Edit .env with your settings

# Frontend uses next.config.js for env vars
```

5. **Start services**

Terminal 1 - Backend:
```bash
cd app/backend
pnpm dev
```

Terminal 2 - Frontend:
```bash
cd app/frontend
pnpm dev
```

6. **Access the app**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 📖 User Guide

### For Collection Owners

1. **Initialize Collection**
   - Connect wallet
   - Navigate to Collections page
   - Add your collection (merkle tree address, IPFS hash, supply)
   - Sign initialization transaction

2. **Index Metadata**
   - Backend automatically fetches from IPFS
   - Calculates rarity scores
   - Progress shown in real-time

3. **Sync On-Chain**
   - Sync rarity data to blockchain
   - Set rarity thresholds
   - Enable assured minting

### For Minters

1. **Browse Collections**
   - View indexed collections
   - Check rarity distributions
   - See collection stats

2. **Check Rarities**
   - Search specific NFTs
   - Filter by minimum rarity
   - View detailed attributes

3. **Mint with Assurance**
   - Set minimum rarity threshold
   - Only eligible NFTs shown
   - Mint with confidence

## 🔧 Development

### Smart Contract Development

```bash
# Build
anchor build

# Test
anchor test

# Deploy
anchor deploy
```

### Backend Development

```bash
cd app/backend

# Run tests
pnpm test

# Build
pnpm build

# Format code
pnpm format
```

### Frontend Development

```bash
cd app/frontend

# Run tests
pnpm test

# Build
pnpm build

# Lint
pnpm lint
```

## 📊 API Documentation

See [Backend README](app/backend/README.md) for detailed API documentation.

Key endpoints:
- `POST /api/collections/initialize-transaction`
- `POST /api/collections/index`
- `POST /api/rarity/check`
- `GET /api/rarity/:address/distribution`

## 🚢 Deployment

### Smart Contract
1. Build program: `anchor build`
2. Deploy to mainnet: `anchor deploy --provider.cluster mainnet`
3. Update program ID in configs

### Backend
- Deploy with Docker or PM2
- Ensure Redis is accessible
- Set production environment variables

### Frontend
- Deploy to Vercel (recommended)
- Or build and serve with any Node.js host
- Configure API URL for production

## 🔐 Security

- All rarity data verified on-chain
- Wallet signatures required for operations
- Rate limiting on API endpoints
- Input validation and sanitization

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Solana Foundation
- Metaplex team
- Anchor framework contributors
- Our amazing community

## 📞 Support

- Discord: [Join our server](https://discord.gg/nfting)
- Twitter: [@NFTingPlatform](https://twitter.com/nfting)
- Email: support@nfting.io

---

Built with ❤️ by the NFTing team 