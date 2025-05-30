# NFTing Frontend

Beautiful and modern frontend for assured rarity NFT minting on Solana.

## Overview

A Next.js application that provides:
- Collection browsing and management
- NFT metadata indexing interface
- Rarity checking and visualization
- Assured rarity minting
- Wallet integration with popular Solana wallets

## Features

- 🎨 Beautiful, modern UI with animations
- 🔐 Secure wallet integration
- 📊 Real-time rarity statistics
- ⚡ Lightning-fast performance
- 📱 Fully responsive design
- 🌙 Dark mode optimized

## Prerequisites

- Node.js 18+
- pnpm package manager
- Backend service running (see backend README)

## Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Configuration

The app uses environment variables defined in `next.config.js`:

```javascript
env: {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta',
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
}
```

For production, create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://your-rpc-endpoint.com
```

## Pages

### Home (`/`)
- Landing page with hero section
- Feature highlights
- Call-to-action buttons

### Collections (`/collections`)
- Browse indexed collections
- Add new collections
- View collection statistics
- Initialize and sync collections

### Mint (`/mint`)
- Check NFT rarities
- Set minimum rarity thresholds
- Mint NFTs with assured rarity

## Usage Guide

### Adding a Collection

1. Connect your wallet
2. Navigate to Collections page
3. Click "Add Collection"
4. Enter:
   - Collection address (Merkle tree)
   - IPFS hash
   - Total supply
5. Sign the initialization transaction
6. Wait for indexing to complete

### Checking Rarity

1. Select a collection
2. View rarity distribution
3. Search for specific NFTs by index
4. Filter by minimum rarity score

### Minting with Assured Rarity

1. Select collection and minimum rarity
2. Review eligible NFTs
3. Choose NFT to mint
4. Sign and send transaction

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Animations**: Framer Motion
- **State Management**: React Query
- **Wallet Integration**: Solana Wallet Adapter
- **Icons**: Lucide React
- **Charts**: Recharts

## Project Structure

```
src/
├── pages/
│   ├── _app.tsx         # App wrapper with providers
│   ├── index.tsx        # Landing page
│   ├── collections.tsx  # Collections management
│   └── mint.tsx         # Minting interface
├── lib/
│   └── api.ts          # API client
├── components/         # Reusable components
├── styles/
│   └── globals.css     # Global styles
└── types/             # TypeScript definitions
```

## Styling

The app uses a custom Tailwind configuration with:
- Custom color palette (primary/accent)
- Glass morphism effects
- Gradient animations
- Neon glow effects

Key utility classes:
- `.gradient-bg` - Animated gradient background
- `.glass-effect` - Glassmorphism card style
- `.neon-glow` - Neon shadow effect
- `.text-gradient` - Gradient text effect

## Development

### Running Locally

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Code Style

- Use TypeScript for all files
- Follow React best practices
- Keep components small and focused
- Use custom hooks for complex logic

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project to Vercel
3. Set environment variables
4. Deploy

### Traditional Hosting

```bash
# Build the application
pnpm build

# The output will be in .next directory
# Serve with Node.js
pnpm start
```

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
RUN npm install -g pnpm && pnpm install --prod
EXPOSE 3000
CMD ["pnpm", "start"]
```

## Performance Optimization

- Images optimized with Next.js Image component
- Code splitting for faster initial load
- API response caching with React Query
- Lazy loading for heavy components

## Troubleshooting

### Wallet Connection Issues
- Ensure wallet extension is installed
- Check network settings match
- Try refreshing the page

### API Connection Errors
- Verify backend is running
- Check NEXT_PUBLIC_API_URL is correct
- Look for CORS issues in console

### Build Errors
- Clear `.next` directory
- Delete `node_modules` and reinstall
- Check for TypeScript errors

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

## License

MIT 