import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

// Just for checking the parameter order
const payer = new PublicKey('11111111111111111111111111111111');
const associatedToken = new PublicKey('22222222222222222222222222222222');
const owner = new PublicKey('33333333333333333333333333333333');
const mint = new PublicKey('44444444444444444444444444444444');

// Check the correct signature for createAssociatedTokenAccountInstruction
const instruction = createAssociatedTokenAccountInstruction(
  payer,           // Payer for the transaction
  associatedToken, // Associated token account address
  owner,           // Owner of the token account
  mint            // Mint of the token
); 