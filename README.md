# Bubblegum Rarity Filtering System

A Solana program that filters NFT mints from Bubblegum (Metaplex Compressed NFTs) based on rarity score thresholds. This system allows creators to ensure only NFTs above certain rarity thresholds can be minted.

## Overview

This program provides a middleware layer between users and the Bubblegum program for minting compressed NFTs. It:

1. Predicts the next NFT that would be minted based on Bubblegum's deterministic asset ID generation
2. Checks if that NFT meets the minimum rarity threshold
3. Only allows the mint to proceed if the rarity threshold is met

## How It Works

### Asset ID Generation

Bubblegum's asset IDs are generated deterministically based on:
- The merkle tree public key
- A sequential nonce (the current mint count)

This means we can predict the exact asset ID of the next NFT that will be minted.

### Rarity Calculation

Our system works as follows:

1. **Initialization**: Each merkle tree is associated with a rarity state account that stores:
   - Rarity thresholds (e.g., common 50, rare 75, legendary 90)
   - A map of potential NFT indices to rarity scores (0-100)

2. **Mint Validation**:
   - Reads the current mint count from the merkle tree
   - Calculates the next asset ID that will be minted
   - Uses that asset ID as a deterministic seed to select an index in the rarity map
   - Verifies the rarity score at that index meets the minimum threshold
   - Allows or rejects the mint based on the result

3. **Client Integration**:
   - Client code creates a transaction that first calls our validate_mint instruction
   - If validation passes, the transaction proceeds to call Bubblegum's mint_v1 instruction
   - If validation fails, the transaction fails with a RarityBelowThreshold error

## Usage

### Setup the Rarity System

```typescript
// Create a new merkle tree
const { merkleTree, treeAuthority } = await minter.createMerkleTree();

// Initialize rarity state for the tree
const { rarityState } = await minter.initializeRarityState(
  merkleTree, 
  merkleTree, // merkle tree account
  [50, 75, 90] // rarity tiers
);

// Upload rarity data
const rarityScores = [...] // Array of u8 rarity scores (0-100)
await minter.updateRarityData(rarityState, rarityScores);
```

### Mint with Rarity Validation

```typescript
// Mint an NFT with rarity validation
await minter.mintWithRarityCheck(
  merkleTree,
  treeAuthority,
  rarityState,
  70, // Min rarity percentage
  recipientWallet.publicKey,
  { name: "Rare NFT", uri: "https://example.com/nft/metadata.json" }
);
```

### Batch Mint Testing

For creators wanting to test mint probabilities with different rarity thresholds:

```typescript
// Try to mint multiple NFTs to analyze success rate
const mintResults = await Promise.allSettled(
  Array(100).fill(null).map(() => 
    minter.mintWithRarityCheck(
      merkleTree, treeAuthority, rarityState, 70,
      wallet.publicKey
    )
  )
);

// Calculate success rate
const successRate = mintResults.filter(r => r.status === 'fulfilled').length / 100;
console.log(`Success rate with 70% threshold: ${successRate * 100}%`);
```

## Program Architecture

### On-Chain Components

1. **RarityState Account**
   - Stores rarity thresholds and rarity map
   - Linked to a specific merkle tree

2. **Initialize Instruction**
   - Creates a new RarityState account for a merkle tree
   - Sets initial rarity thresholds

3. **UpdateRarityData Instruction**
   - Updates the rarity map with new scores
   - Can be called in chunks for large collections

4. **ValidateMint Instruction**
   - Predicts the next NFT mint
   - Validates its rarity against the threshold

### Client Components

1. **RarityBubblegumMinter**
   - TypeScript class for interacting with the program
   - Handles tree creation, initialization, and rarity updates
   - Creates combined transactions for validation and minting

## Benefits

1. **Creator Control**: Creators can ensure only high-quality NFTs are minted
2. **Fair Distribution**: Uses deterministic but unpredictable mapping from IDs to rarity scores
3. **Transparent**: Rarity scores are publicly verifiable
4. **Efficiency**: Works with compressed NFTs for low gas fees

## Development

### Build the program

```bash
anchor build
```

### Run tests

```bash
anchor test
```

### Deploy

```bash
anchor deploy
```

## Integration with Marketplaces and Wallets

The system is fully compatible with any Metaplex Bubblegum-supporting marketplace or wallet. The minted NFTs are standard compressed NFTs that can be transferred, listed, and traded normally.

## License

MIT
