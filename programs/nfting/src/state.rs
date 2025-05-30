use anchor_lang::prelude::*;

// Define the size of the state account
pub const STATE_SIZE: usize = 8 + // Discriminator
    32 + // authority: Pubkey
    32 + // merkle_tree: Pubkey
    1 + // bump
    2 + // max_depth: u16
    2 + // max_buffer_size: u16
    4 + // Vec length prefix for rarity_thresholds
    50 + // rarity_thresholds: Vec<u8> (reasonable max size)
    4 + // Vec length prefix for rarity_map
    65535 + // rarity_map: Vec<u8> (max reasonable size for NFT collection)
    8 + // total_mints: u64
    4 + // Vec length prefix for mint_records
    1000 * MINT_RECORD_SIZE + // mint_records: Vec<MintRecord> (reasonable max size)
    4 + // Vec length prefix for mint_patterns
    100 * MINT_PATTERN_SIZE; // mint_patterns: Vec<MintPattern> (reasonable max size)

// Size of a MintRecord
pub const MINT_RECORD_SIZE: usize = 
    8 + // Option discriminator
    8 + // mint_index: Option<u64>
    32 + // asset_id: Pubkey
    8 + // mint_count: u64
    8 + // Option discriminator
    1 + // rarity_score: Option<u8>
    32 + // minter: Pubkey
    8; // timestamp: i64

// Size of a MintPattern
pub const MINT_PATTERN_SIZE: usize = 
    8 + // difference: u64
    8 + // occurrences: u64
    8; // probability: f64 (stored as bits)

#[account]
pub struct RarityState {
    // The authority that can update this account
    pub authority: Pubkey,
    
    // The merkle tree this state is associated with
    pub merkle_tree: Pubkey,
    
    // The bump used for PDA derivation
    pub bump: u8,
    
    // Maximum depth of the merkle tree (copied from tree config)
    pub max_depth: u16,
    
    // Maximum buffer size (copied from tree config)
    pub max_buffer_size: u16,
    
    // Rarity thresholds for different tiers (e.g. [50, 75, 90])
    pub rarity_thresholds: Vec<u8>,
    
    // Map of NFT indices to rarity scores (0-100)
    pub rarity_map: Vec<u8>,
    
    // Total number of mints analyzed
    pub total_mints: u64,
    
    // Records of analyzed mints
    pub mint_records: Vec<MintRecord>,
    
    // Patterns detected in minting sequence
    pub mint_patterns: Vec<MintPattern>,
}

// Record of a single mint transaction
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintRecord {
    // The NFT index minted (if we could determine it)
    pub mint_index: Option<u64>,
    
    // Asset ID (public key of the mint) 
    pub asset_id: Pubkey,
    
    // The mint count at the time this NFT was minted
    pub mint_count: u64,
    
    // Rarity score of this NFT (if known)
    pub rarity_score: Option<u8>,
    
    // Address of the minter
    pub minter: Pubkey,
    
    // Unix timestamp when this mint was recorded
    pub timestamp: i64,
}

// Pattern detected in mint sequence
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintPattern {
    // Difference between consecutive mint indices
    pub difference: u64,
    
    // Number of times this pattern was observed
    pub occurrences: u64,
    
    // Approximate probability of this pattern (0.0-1.0)
    pub probability: f64,
}
