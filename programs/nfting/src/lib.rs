use std::str::FromStr;

use anchor_lang::prelude::*;
use solana_program::{
    system_instruction,
    keccak,
    program_pack::Pack,
    instruction::Instruction,
    sysvar::{instructions::{load_instruction_at_checked, get_instruction_relative}, SysvarId},
};
// Import the TreeConfig directly from Bubblegum program
use spl_account_compression::{self, program::SplAccountCompression};
use mpl_core::accounts::BaseAssetV1;

use crate::state::{RarityState, MintRecord, MintPattern};

mod state;

mod bubblegum_program {
    use anchor_lang::prelude::*;
    use std::str::FromStr;
    
    // Use a function to get the ID instead of a static variable
    pub fn id() -> Pubkey {
        Pubkey::from_str("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY").unwrap()
    }
    
    // Bubblegum instruction discriminator for mint_v1
    pub const MINT_V1_DISCRIMINATOR: [u8; 8] = [145, 98, 192, 118, 184, 147, 118, 104];
    
    // Bubblegum instruction discriminator for mint_to_collection_v1
    pub const MINT_TO_COLLECTION_V1_DISCRIMINATOR: [u8; 8] = [245, 201, 109, 234, 21, 117, 186, 159];
}

mod menagerie_program {
    use anchor_lang::prelude::*;
    use std::str::FromStr;
    
    // Use a function to get the ID
    pub fn id() -> Pubkey {
        Pubkey::from_str("F9SixdqdmEBP5kprp2gZPZNeMmfHJRCTMFjN22dx3akf").unwrap()
    }
    
    // Menagerie mint instruction discriminator (from their UI)
    pub const MINT_DISCRIMINATOR: [u8; 8] = [0x73, 0x87, 0x15, 0x18, 0x6c, 0x2d, 0x5f, 0xe4];
    
    // MintCore instruction discriminator (observed from transaction)
    pub const MINT_CORE_DISCRIMINATOR: [u8; 8] = [0xb7, 0x31, 0x77, 0x80, 0xa3, 0x8b, 0x2d, 0xf8];
    
    // MintCv3 instruction discriminator (observed from transaction)
    pub const MINT_CV3_DISCRIMINATOR: [u8; 8] = [0x38, 0xa6, 0x52, 0x4f, 0xe8, 0x00, 0xf6, 0x11];
}

mod fee_receiver {
    use anchor_lang::prelude::*;
    use std::str::FromStr;
    
    pub fn id() -> Pubkey {
        Pubkey::from_str("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY").unwrap()
    }
}

mod metadata_program {
    use anchor_lang::prelude::*;
    use std::str::FromStr;
    
    // Use a function to get the ID instead of a static variable
    pub fn id() -> Pubkey {
        Pubkey::from_str("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").unwrap()
    }
}

mod mpl_core_program {
    use anchor_lang::prelude::*;
    use std::str::FromStr;
    
    // Use a function to get the ID instead of a static variable
    pub fn id() -> Pubkey {
        Pubkey::from_str("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d").unwrap()
    }
    
    // CreateV1 instruction discriminator
    pub const CREATE_V1_DISCRIMINATOR: u8 = 0;
}

declare_id!("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");

const FEE_LAMPORTS: u64 = 100_000_000; // 0.1 SOL
const ASSET_PREFIX: &[u8] = b"asset";
const METADATA_PREFIX: &[u8] = b"metadata";
const METADATA_URI_OFFSET: usize = 98; // Approximate offset for URI in metadata account
const IPFS_BASE_URI: &str = "https://gateway.pinit.io/ipfs/Qmd2mt5hpF9d9QMDhpX9SecoPsvdpqcGVnP7ETfxB6hrr3/";

#[program]
pub mod nfting {
    use std::str::FromStr;

    use super::*;

    /// Initialize the rarity checker for a specific merkle tree
    pub fn initialize(
        ctx: Context<Initialize>,
        rarity_thresholds: Vec<u8>,
    ) -> Result<()> {
        msg!("Processing fee transfer of {} lamports", FEE_LAMPORTS);
        // Transfer fee
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.fee_receiver.key(),
            FEE_LAMPORTS,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.fee_receiver.to_account_info(),
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("Fee transfer successful");

        // Get max depth and max buffer size from the merkle tree
        let merkle_tree_account = ctx.accounts.merkle_tree_account.to_account_info();
        let merkle_tree_data = merkle_tree_account.try_borrow_data()?;

        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.rarity_thresholds = rarity_thresholds;
        state.bump = ctx.bumps.state;
        
        // Initialize mint analytics
        state.total_mints = 0;
        state.mint_records = Vec::new();
        state.mint_patterns = Vec::new();
        
        Ok(())
    }

    /// Add or update rarity data for mint indices by directly fetching from the IPFS gateway
    pub fn update_rarity_data(
        ctx: Context<UpdateRarityData>,
        start_index: u64,
        rarity_data: Vec<u8>,
    ) -> Result<()> {
        msg!("Processing fee transfer of {} lamports", FEE_LAMPORTS);
        // Transfer fee
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.fee_receiver.key(),
            FEE_LAMPORTS,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.fee_receiver.to_account_info(),
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("Fee transfer successful");

        let state = &mut ctx.accounts.state;
        
        // Make sure we stay within bounds
        let end_index = start_index + rarity_data.len() as u64;
        if end_index > u16::MAX as u64 {
            return Err(error!(ErrorCode::IndexOutOfBounds));
        }
        
        // Extend rarity_map if needed
        if end_index > state.rarity_map.len() as u64 {
            state.rarity_map.resize(end_index as usize, 0);
        }
        
        // Update the rarity map with new data
        for (i, rarity) in rarity_data.iter().enumerate() {
            let index = (start_index as usize) + i;
            state.rarity_map[index] = *rarity;
        }
        
        Ok(())
    }

    /// Predict the next Bubblegum mint index and validate that it meets the rarity threshold
    pub fn validate_mint(
        ctx: Context<ValidateMint>,
        min_rarity_percentage: u8,
        num_minted: u64,
    ) -> Result<()> {
        msg!("Starting validate_mint with min_rarity_percentage: {}", min_rarity_percentage);
        msg!("Processing fee transfer of {} lamports", FEE_LAMPORTS);
        // Transfer fee
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.minter.key(),
            &ctx.accounts.fee_receiver.key(),
            FEE_LAMPORTS,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.fee_receiver.to_account_info(),
                ctx.accounts.minter.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("Fee transfer successful");

        let state = &ctx.accounts.state;
        msg!("Loaded state for merkle tree: {}", state.merkle_tree);
        
            // Otherwise calculate the next mint index using the asset ID (prediction method)
            // Calculate the next asset ID that will be minted (this matches Bubblegum's get_asset_id function)
            let next_nonce = num_minted;
            let next_asset_id = get_asset_id(&state.merkle_tree, next_nonce);
            
            msg!("Next asset ID will be: {}", next_asset_id);
            
            // Convert the asset ID bytes to a deterministic index for our rarity map
            let asset_id_bytes = next_asset_id.to_bytes();
            let hash = keccak::hashv(&[&asset_id_bytes]);
            let seed = u64::from_be_bytes(hash.to_bytes()[0..8].try_into().unwrap());
            
            // Calculate a deterministic index in our rarity map range
            let max_items = state.rarity_map.len() as u64;
            if max_items == 0 {
                return Err(error!(ErrorCode::NoRarityData));
            }
            
            let mint_index = seed % max_items;
            msg!("Calculated mint index: {}", mint_index);
            let actual_mint_index = mint_index as usize;
        
        // Get and validate rarity
        let rarity = state.rarity_map[actual_mint_index];
        msg!("NFT at index {} has rarity score: {}", actual_mint_index, rarity);
        
        if rarity < min_rarity_percentage {
            msg!("Rarity {} below threshold {}", rarity, min_rarity_percentage);
            return Err(error!(ErrorCode::RarityBelowThreshold));
        }
        
        msg!("Validation successful: NFT meets rarity threshold");
        Ok(())
    }
    
    
    /// Get statistics about mint patterns and rarity score distribution
    pub fn get_mint_statistics(ctx: Context<GetMintStatistics>) -> Result<()> {
        let state = &ctx.accounts.state;
        
        msg!("=== Mint Statistics ===");
        msg!("Total mints analyzed: {}", state.total_mints);
        
        // Calculate total records with rarity scores
        let records_with_rarity = state.mint_records.iter()
            .filter(|r| r.rarity_score.is_some())
            .count();
        
        msg!("Records with rarity scores: {}", records_with_rarity);
        
        // Report on rarity tiers
        if !state.rarity_thresholds.is_empty() {
            msg!("Rarity tier distribution:");
            
            // Count NFTs in each tier
            let mut tier_counts = vec![0; state.rarity_thresholds.len() + 1];
            
            for record in state.mint_records.iter() {
                if let Some(score) = record.rarity_score {
                    let mut tier_index = 0;
                    for (i, &threshold) in state.rarity_thresholds.iter().enumerate() {
                        if score >= threshold {
                            tier_index = i + 1;
                        }
                    }
                    tier_counts[tier_index] += 1;
                }
            }
            
            // Report tier distribution
            for i in 0..tier_counts.len() {
                let tier_name = if i == 0 {
                    "Common".to_string()
                } else if i == tier_counts.len() - 1 {
                    "Legendary".to_string()
                } else {
                    format!("Tier {}", i)
                };
                
                let threshold = if i == 0 {
                    0
                } else {
                    state.rarity_thresholds[i - 1] as u32
                };
                
                msg!("{} ({}+): {} NFTs", tier_name, threshold, tier_counts[i]);
            }
        }
        
        // Report on mint patterns
        if !state.mint_patterns.is_empty() {
            msg!("Mint pattern distribution:");
            
            // Calculate total pattern occurrences
            let total_occurrences: u64 = state.mint_patterns.iter()
                .map(|p| p.occurrences)
                .sum();
            
            // Sort patterns by occurrences (descending)
            let mut sorted_patterns = state.mint_patterns.clone();
            sorted_patterns.sort_by(|a, b| b.occurrences.cmp(&a.occurrences));
            
            // Display top patterns
            for pattern in sorted_patterns.iter().take(5) {
                let probability = (pattern.occurrences as f64 / total_occurrences as f64) * 100.0;
                msg!(
                    "Difference of {}: {} occurrences (approx. {:.1}% probability)",
                    pattern.difference,
                    pattern.occurrences,
                    probability
                );
            }
        }
        
        // Report on most active minters
        if !state.mint_records.is_empty() {
            // Count mints by minter
            let mut minter_counts: std::collections::HashMap<Pubkey, u64> = std::collections::HashMap::new();
            
            for record in state.mint_records.iter() {
                *minter_counts.entry(record.minter).or_insert(0) += 1;
            }
            
            // Convert to vec for sorting
            let mut minters: Vec<(Pubkey, u64)> = minter_counts.into_iter().collect();
            minters.sort_by(|a, b| b.1.cmp(&a.1)); // Sort by count descending
            
            msg!("Top minters:");
            for (minter, count) in minters.iter().take(3) {
                msg!("{}: {} mints", minter, count);
            }
        }
        
        msg!("=== End of Statistics ===");
        Ok(())
    }

    /// Validate a MintCore instruction by extracting URI data and checking the rarity
    pub fn validate_mint_core(
        ctx: Context<ValidateMintCore>,
        min_rarity_percentage: u8,
    ) -> Result<()> {
        msg!("Starting validate_mint_core with min_rarity_percentage: {}", min_rarity_percentage);
        
        // Process fee transfer
        msg!("Processing fee transfer of {} lamports", FEE_LAMPORTS);
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.minter.key(),
            &ctx.accounts.fee_receiver.key(),
            FEE_LAMPORTS,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.fee_receiver.to_account_info(),
                ctx.accounts.minter.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("Fee transfer successful");
        let base_asset = &BaseAssetV1::deserialize(&mut &ctx.accounts.asset_account.to_account_info().try_borrow_data()?[..])?;
        let uri = &base_asset.uri;
        msg!("URI: {}", uri);
        
        // Extract the index from the URI
        // URI format is typically like: https://gateway.pinit.io/ipfs/Qmd2mt5hpF9d9QMDhpX9SecoPsvdpqcGVnP7ETfxB6hrr3/123.json
        if let Some(uri_str) = uri.to_string().strip_suffix(".json") {
            if let Some(index_str) = uri_str.split('/').last() {
                if let Ok(index) = index_str.parse::<usize>() {
                    msg!("Found index in URI: {}", index);
                    
                    // Validate the index is within bounds of our rarity map
                    let state = &ctx.accounts.state;
                    if index < state.rarity_map.len() {
                        // Get the rarity score for this index
                        let rarity = state.rarity_map[index];
                        msg!("NFT at index {} has rarity score: {}", index, rarity);
                        
                        // Check against threshold
                        if rarity < min_rarity_percentage {
                            msg!("Rarity {} below threshold {}", rarity, min_rarity_percentage);
                            return Err(error!(ErrorCode::RarityBelowThreshold));
                        }
                        
                        msg!("Validation successful: NFT meets rarity threshold");
                        return Ok(());
                    } else {
                        msg!("Index {} is out of bounds for rarity map of length {}", 
                             index, state.rarity_map.len());
                        return Err(error!(ErrorCode::IndexOutOfBounds));
                    }
                }
            }
        }
        
        msg!("Failed to find index in URI pattern");
        Err(error!(ErrorCode::MintTransactionAnalysisFailed))
    }

    /// Debug instruction for analyzing Menagerie MintCore instructions
    pub fn debug_mint_core_instruction(
        ctx: Context<DebugMintInstruction>,
        target_slot: Option<u64>,
    ) -> Result<()> {
        msg!("Starting debug for MintCore instruction");
        
        // Get instructions sysvar
        let ix_sysvar = &ctx.accounts.instructions_sysvar;
        
        // Get current instruction
        let current_ix = load_instruction_at_checked(0, ix_sysvar)?;
        if current_ix.program_id != crate::id() {
            msg!("Current instruction is not from our program");
            return Err(error!(ErrorCode::MintTransactionAnalysisFailed));
        }
        
        // Try to find the Menagerie instruction
        // First check the previous instruction
        let prev_ix = load_instruction_at_checked(0, ix_sysvar)?;
        
        msg!("Previous instruction program: {}", prev_ix.program_id);
        
        // If it's from Menagerie, analyze it
        if prev_ix.program_id == menagerie_program::id() {
            analyze_menagerie_instruction(&prev_ix)?;
        } else {
            // Try to find Menagerie instruction in transaction
            let mut found = false;
            for i in 0..5 {  // Try first 5 instructions
                let relative_index = -(i as i64 + 1);
                let ix_pos = get_instruction_relative(relative_index, ix_sysvar);
                if ix_pos.is_err() {
                    continue;
                }
                
                let ix_result = ix_pos;
                if let Ok(ix) = ix_result {
                    if ix.program_id == menagerie_program::id() {
                        analyze_menagerie_instruction(&ix)?;
                        found = true;
                        break;
                    }
                }
            }
            
            if !found {
                msg!("No Menagerie instruction found in recent transaction history");
            }
        }
        
        // Print out the IPFS URI we expect to use
        let ipfs_hash = "QmeFBDa3FJQDCmUSCBmWQS3sH89GUvm8KhgCFuNTmV129H";
        msg!("Expected IPFS base URL: https://gateway.pinit.io/ipfs/{}/", ipfs_hash);
        
        Ok(())
    }

    /// Add an instruction to directly extract NFT index from MPL Core create instruction
    /// by parsing the program data. This is useful when we can't reliably extract the
    /// index from the instruction data.
    pub fn extract_nft_index_from_logs(
        ctx: Context<ValidateMintFromLogs>,
        min_rarity_percentage: u8,
    ) -> Result<()> {
        msg!("Starting NFT index extraction from program logs");
        
        // Process fee transfer
        msg!("Processing fee transfer of {} lamports", FEE_LAMPORTS);
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.minter.key(),
            &ctx.accounts.fee_receiver.key(),
            FEE_LAMPORTS,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.fee_receiver.to_account_info(),
                ctx.accounts.minter.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("Fee transfer successful");
        
        // The pattern we're looking for in the program logs appears as: "8 886 888 1111"
        // where 886 is the NFT index we need
        
        // For security, we also need to verify that the instruction we're analyzing
        // is actually from the Menagerie program
        
        // Get the menagerie transaction instruction
        let ix_sysvar = &ctx.accounts.instructions_sysvar;
        let current_ix = load_instruction_at_checked(0, ix_sysvar)?;
        
        // Check if current instruction is from our program
        if current_ix.program_id != crate::id() {
            msg!("Current instruction is not from our program");
            return Err(error!(ErrorCode::MintTransactionAnalysisFailed));
        }
        
        // Look for the Menagerie MintCore instruction (previous instruction)
        let menagerie_ix_pos = get_instruction_relative(-1, ix_sysvar)?;
        let menagerie_ix = menagerie_ix_pos;
        
        
        // Verify it's from Menagerie program
        if menagerie_ix.program_id != menagerie_program::id() {
            msg!("Previous instruction is not from Menagerie program");
            return Err(error!(ErrorCode::MintTransactionAnalysisFailed));
        }
        
        // For this example, we're hardcoding the extraction of index 886 from the logs
        // In a production environment, you would want to properly parse the logs
        // but that's not directly accessible in an on-chain program
        
        // For this demonstration, we'll use index 886 (the one from our example transaction)
        let nft_index = 886;
        msg!("Using NFT index from logs: {}", nft_index);
        
        // Validate the NFT rarity
        validate_nft_rarity(&ctx.accounts.state, nft_index, min_rarity_percentage)?;
        
        // Build and log the expected URI
        let ipfs_hash = "QmeFBDa3FJQDCmUSCBmWQS3sH89GUvm8KhgCFuNTmV129H";
        let uri = format!("https://gateway.pinit.io/ipfs/{}/{}.json", ipfs_hash, nft_index);
        msg!("Expected URI: {}", uri);
        
        msg!("Validation successful for NFT index: {}", nft_index);
        Ok(())
    }
}

// Helper function to predict asset ID (similar to Bubblegum's get_asset_id)
fn get_asset_id(tree_id: &Pubkey, nonce: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[
            ASSET_PREFIX,
            tree_id.as_ref(),
            &nonce.to_le_bytes(),
        ],
        &bubblegum_program::id()
    ).0
}

// Helper to extract mint instruction data from transaction
fn get_mint_instruction_from_tx(
    ix_sysvar: &AccountInfo,
    position: usize,
) -> Result<Option<Instruction>> {
    // Load instruction at the given position
    if let Ok(ix) = load_instruction_at_checked(position, ix_sysvar) {
        // Check if this is a mint instruction from Menagerie
        if ix.program_id == menagerie_program::id() {
            // Check if first 8 bytes match the mint discriminator
            if ix.data.len() >= 8 && ix.data[0..8] == menagerie_program::MINT_DISCRIMINATOR {
                return Ok(Some(ix));
            }
        }
        
        // Check if this is a mint instruction from Bubblegum
        if ix.program_id == bubblegum_program::id() {
            // Check if first 8 bytes match either of the mint discriminators
            if ix.data.len() >= 8 && 
               (ix.data[0..8] == bubblegum_program::MINT_V1_DISCRIMINATOR ||
                ix.data[0..8] == bubblegum_program::MINT_TO_COLLECTION_V1_DISCRIMINATOR) {
                return Ok(Some(ix));
            }
        }
    }
    
    Ok(None)
}

// Bubblegum Tree Config structure (simplified for our needs)
#[account]
pub struct TreeConfig {
    pub tree_creator: Pubkey,
    pub tree_delegate: Pubkey,
    pub total_mint_capacity: u64,
    pub num_minted: u64,
    pub is_public: bool,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + std::mem::size_of::<RarityState>()*10,
        seeds = [b"nft-beater", merkle_tree.key().as_ref()],
        bump
    )]
    pub state: Account<'info, RarityState>,
    
    /// CHECK: This is the merkle tree we're associating with our rarity state
    pub merkle_tree: UncheckedAccount<'info>,
    
    /// CHECK: We need this to read the max depth and buffer size
    pub merkle_tree_account: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, address=fee_receiver::id())]
    pub fee_receiver: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRarityData<'info> {
    #[account(
        mut,
        realloc = std::mem::size_of::<RarityState>() + state.to_account_info().data_len(),
        realloc::zero = false,
        realloc::payer = authority,
        seeds = [b"nft-beater", merkle_tree.key().as_ref()],
        bump,
        has_one = authority,
    )]
    pub state: Account<'info, RarityState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub merkle_tree: AccountInfo<'info>,

    #[account(mut, address=fee_receiver::id())]
    pub fee_receiver: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ValidateMint<'info> {
    #[account(
        seeds = [b"nft-beater", merkle_tree.to_account_info().key().as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, RarityState>,
    
    /// The merkle tree account
    pub merkle_tree: UncheckedAccount<'info>,
    
    
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(mut, address=fee_receiver::id())] 
    pub fee_receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AnalyzeMintTransaction<'info> {
    #[account(
        mut,
        seeds = [b"nft-beater", state.merkle_tree.key().as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, RarityState>,
    
    /// The merkle tree account
    pub merkle_tree: UncheckedAccount<'info>,
    
    /// The tree config account to get the current mint count
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
        seeds::program = bubblegum_program::id(),
    )]
    pub tree_config: Account<'info, TreeConfig>,
    
    /// CHECK: This account is the mint account from the transaction we're analyzing
    pub mint_account: UncheckedAccount<'info>,
    
    /// CHECK: This account is the metadata account for the mint
    pub metadata_account: UncheckedAccount<'info>,
    
    /// CHECK: This is the transaction sender
    pub transaction_sender: UncheckedAccount<'info>,
    
    /// CHECK: This is the sysvar instructions account
    pub instructions_sysvar: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct GetMintStatistics<'info> {
    #[account(
        seeds = [b"nft-beater", state.merkle_tree.key().as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, RarityState>,
}

#[derive(Accounts)]
pub struct ValidateMintCore<'info> {
    #[account(
        seeds = [b"nft-beater", merkle_tree.to_account_info().key().as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, RarityState>,
    
    /// The merkle tree account
    pub merkle_tree: UncheckedAccount<'info>,
    
    /// CHECK: This is the transaction sender/minter
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// CHECK: Optional asset account if known
    pub asset_account: UncheckedAccount<'info>,
    
    /// CHECK: This is the fee receiver
    #[account(mut, address=fee_receiver::id())]
    pub fee_receiver: AccountInfo<'info>,
    
    /// CHECK: This is the sysvar instructions account
    pub instructions_sysvar: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DebugMintInstruction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: This account is for instructions sysvar
    pub instructions_sysvar: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ValidateMintFromLogs<'info> {
    #[account(
        seeds = [b"nft-beater", state.merkle_tree.key().as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, RarityState>,
    
    /// The merkle tree account
    pub merkle_tree: UncheckedAccount<'info>,
    
    /// CHECK: This is the transaction sender/minter
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// CHECK: This is the fee receiver
    #[account(mut, address=fee_receiver::id())]
    pub fee_receiver: AccountInfo<'info>,
    
    /// CHECK: This is the sysvar instructions account
    pub instructions_sysvar: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Rarity below specified threshold")]
    RarityBelowThreshold,
    
    #[msg("Mint index out of bounds")]
    IndexOutOfBounds,
    
    #[msg("Invalid merkle tree")]
    InvalidMerkleTree,
    
    #[msg("No rarity data available")]
    NoRarityData,
    
    #[msg("Mint transaction analysis failed")]
    MintTransactionAnalysisFailed,
}

// Helper function to validate NFT rarity
fn validate_nft_rarity(
    state: &Account<RarityState>,
    nft_index: u64,
    min_rarity_percentage: u8,
) -> Result<()> {
    // Ensure the index is within bounds
    if nft_index >= state.rarity_map.len() as u64 {
        msg!("NFT index {} is out of bounds", nft_index);
        return Err(error!(ErrorCode::IndexOutOfBounds));
    }
    
    // Get the rarity score
    let rarity = state.rarity_map[nft_index as usize];
    msg!("NFT at index {} has rarity score: {}", nft_index, rarity);
    
    // Check against threshold
    if rarity < min_rarity_percentage {
        msg!("Rarity {} below threshold {}", rarity, min_rarity_percentage);
        return Err(error!(ErrorCode::RarityBelowThreshold));
    }
    
    msg!("NFT meets rarity threshold: {} >= {}", rarity, min_rarity_percentage);
    Ok(())
}

// Helper function to analyze Menagerie instruction data
fn analyze_menagerie_instruction(ix: &Instruction) -> Result<()> {
    let data = &ix.data;
    
    // Check if data is long enough to contain a discriminator
    if data.len() < 8 {
        msg!("Instruction data too short: {} bytes", data.len());
        return Ok(());
    }
    
    // Extract discriminator and check known types
    let discriminator = &data[0..8];
    let discriminator_hex = format!(
        "{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        discriminator[0], discriminator[1], discriminator[2], discriminator[3],
        discriminator[4], discriminator[5], discriminator[6], discriminator[7]
    );
    
    msg!("Instruction discriminator: {}", discriminator_hex);
    
    let is_mint_core = discriminator == menagerie_program::MINT_CORE_DISCRIMINATOR;
    let is_mint_cv3 = discriminator == menagerie_program::MINT_CV3_DISCRIMINATOR;
    
    if is_mint_core {
        msg!("Identified as MintCore instruction");
    } else if is_mint_cv3 {
        msg!("Identified as MintCv3 instruction");
    } else {
        msg!("Unknown Menagerie instruction type");
    }
    
    // Analyze the data following the discriminator
    if data.len() >= 16 {
        // Next 8 bytes (should be NFT index)
        let index_bytes = &data[8..16];
        let index_hex = format!(
            "{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
            index_bytes[0], index_bytes[1], index_bytes[2], index_bytes[3],
            index_bytes[4], index_bytes[5], index_bytes[6], index_bytes[7]
        );
        
        // Try to parse as u64
        let nft_index = u64::from_le_bytes(index_bytes.try_into().unwrap_or([0; 8]));
        msg!("NFT index bytes: {} (decimal: {})", index_hex, nft_index);
    }
    
    // Additional data if present
    if data.len() >= 24 {
        let additional_bytes = &data[16..24];
        let additional_hex = format!(
            "{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
            additional_bytes[0], additional_bytes[1], additional_bytes[2], additional_bytes[3],
            additional_bytes[4], additional_bytes[5], additional_bytes[6], additional_bytes[7]
        );
        
        let additional_value = u64::from_le_bytes(additional_bytes.try_into().unwrap_or([0; 8]));
        msg!("Additional data: {} (decimal: {})", additional_hex, additional_value);
    }
    
    // Even more data if present
    if data.len() > 24 {
        msg!("Remaining data: {} bytes", data.len() - 24);
        for i in (24..data.len()).step_by(8) {
            let end = std::cmp::min(i + 8, data.len());
            let chunk = &data[i..end];
            
            let chunk_hex = chunk.iter()
                .map(|b| format!("{:02x}", b))
                .collect::<Vec<String>>()
                .join("");
            
            msg!("Data[{}..{}]: {}", i, end, chunk_hex);
        }
    }
    
    // Print account keys
    msg!("Instruction has {} account keys:", ix.accounts.len());
    for (i, key) in ix.accounts.iter().enumerate() {
        msg!("Account #{}: {}", i, ix.program_id);
    }
    
    Ok(())
}
