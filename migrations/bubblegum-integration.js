"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenagerieRarityIndexer = exports.MenagerieMinter = void 0;
var web3_js_1 = require("@solana/web3.js");
var anchor_1 = require("@coral-xyz/anchor");
var fs = require("fs");
var path = require("path");
var axios_1 = require("axios");
// Require the IDL as a workaround for the .json module resolution issue
var idl = require('../target/idl/nfting.json');
// Program IDs
var NFTING_PROGRAM_ID = new web3_js_1.PublicKey("14m2HBX8Y3FVNwdxGLhnDBHhsHG9QhjNfP7thXqm8iRb");
var MENAGERIE_PROGRAM_ID = new web3_js_1.PublicKey("F9SixdqdmEBP5kprp2gZPZNeMmfHJRCTMFjN22dx3akf");
var TOKEN_PROGRAM_ID = new web3_js_1.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var METADATA_PROGRAM_ID = new web3_js_1.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
var BUBBLEGUM_PROGRAM_ID = new web3_js_1.PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");
var COMPRESSION_PROGRAM_ID = new web3_js_1.PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
var SPL_ACCOUNT_COMPRESSION_ID = new web3_js_1.PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
var SPL_NOOP_ID = new web3_js_1.PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");
var TOKEN_AUTH_RULES_ID = new web3_js_1.PublicKey("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");
var TOKEN_2022_PROGRAM_ID = new web3_js_1.PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
var ASSOCIATED_TOKEN_PROGRAM_ID = new web3_js_1.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
// Constants for settings
var DEFAULT_COMPUTE_UNITS = 525000;
var DEFAULT_COMPUTE_PRICE = 58767; // microLamports
var DEFAULT_TIP_AMOUNT = 0.0001; // SOL
// IPFS metadata URI for Menagerie NFTs
var IPFS_METADATA_BASE_URI = "https://gateway.pinit.io/ipfs/Qmd2mt5hpF9d9QMDhpX9SecoPsvdpqcGVnP7ETfxB6hrr3";
/**
 * Class for handling Menagerie NFT minting
 */
var MenagerieMinter = /** @class */ (function () {
    function MenagerieMinter(connection, wallet, options) {
        // Known addresses from transaction examples
        this.ADDRESSES = {
            paymentReceiver1: new web3_js_1.PublicKey("BYhzyAdSwF9Zg14t91gzAMtvHXewHVYpNeWXTDB9Cgqw"),
            paymentReceiver2: new web3_js_1.PublicKey("Gmxpfs55fBNDT1VeHszFAVrKUjwv2bh8RJP32tT1kQWX"),
            paymentReceiver3: new web3_js_1.PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH"),
            royaltyAddress: new web3_js_1.PublicKey("Gxwp3tF5dueE4ok5knQyZKiHSrMgVC4V1idUq9MkRoqc"),
            metadataAddress: new web3_js_1.PublicKey("DdyCxHFxXi4Mb69giqujAFrkcS1eZTjBGnYsR5hUzBzr"),
            updateAuthorityAddress: new web3_js_1.PublicKey("y6bA3gBy5dsRzVqJV4choAWCNWVVzW8yNLmFz2pV6yw"),
            storageAccount: new web3_js_1.PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH"),
            collectionMint: new web3_js_1.PublicKey("CXbixcWqWyCiwxhHqMPbveQUjeL9r4H3RUZd9LFKcBhe"),
            collectionMetadata: new web3_js_1.PublicKey("H2iK73hVAxG4J4tbbEJEoieeLakwQSBiXaPFw9R5BSCA"),
            collectionMasterEdition: new web3_js_1.PublicKey("CGduSUxsYpoxBUgPKjGw4Amwp3c3hwX7kPNt2VnE63ip"),
            delegateRecord: new web3_js_1.PublicKey("8FTdJhScU4HYruSXkpYXWo9VvB7kSKWjUQQmDMEDaFky"),
            tokenRecord: new web3_js_1.PublicKey("E78TyVGQEg469gZsknn1k8wvjenwkyV7zVYUdrCAr9Pb"),
            authRules: new web3_js_1.PublicKey("eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9"),
            tipAddress: new web3_js_1.PublicKey("Jitotip3UZPKWjEGZecn8gjNmqYKtJ7HA1JpQYKKR6w")
        };
        this.connection = connection;
        this.wallet = wallet;
        this.jitoEndpoint = options === null || options === void 0 ? void 0 : options.jitoEndpoint;
        // Initialize the rarity program
        try {
            var walletAdapter = new anchor_1.Wallet(wallet);
            var provider = new anchor_1.AnchorProvider(connection, walletAdapter, { commitment: 'confirmed', skipPreflight: true });
            // @ts-ignore
            this.rarityProgram = new anchor_1.Program(idl, NFTING_PROGRAM_ID, provider);
            console.log("Rarity assessment program initialized");
        }
        catch (error) {
            console.warn("Could not initialize rarity program, continuing without it:", error);
        }
    }
    /**
     * Check rarity before minting
     */
    MenagerieMinter.prototype.checkRarity = function (nftIndex_1) {
        return __awaiter(this, arguments, void 0, function (nftIndex, minRarityPercentage) {
            var rarityState, result, _a, _b, error_1;
            var _c;
            if (minRarityPercentage === void 0) { minRarityPercentage = 50; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!this.rarityProgram) {
                            console.warn("Rarity program not initialized, skipping rarity check");
                            return [2 /*return*/, true];
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 5, , 6]);
                        console.log("Checking if NFT #".concat(nftIndex, " meets rarity threshold of ").concat(minRarityPercentage, "%"));
                        return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([
                                Buffer.from('nft-beater'),
                                this.ADDRESSES.storageAccount.toBuffer(),
                            ], NFTING_PROGRAM_ID)];
                    case 2:
                        rarityState = (_d.sent())[0];
                        _b = (_a = this.rarityProgram.methods
                            .validateMint(new anchor_1.BN(nftIndex), minRarityPercentage))
                            .accounts;
                        _c = {
                            state: rarityState,
                            merkleTree: this.ADDRESSES.storageAccount
                        };
                        return [4 /*yield*/, this.getTreeConfigPDA()];
                    case 3: return [4 /*yield*/, _b.apply(_a, [(_c.treeConfig = _d.sent(),
                                _c.minter = this.wallet.publicKey,
                                _c.feeReceiver = new web3_js_1.PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
                                _c.systemProgram = web3_js_1.SystemProgram.programId,
                                _c)])
                            .simulate()];
                    case 4:
                        result = _d.sent();
                        console.log("Rarity check successful:", result);
                        return [2 /*return*/, true];
                    case 5:
                        error_1 = _d.sent();
                        console.error("Rarity check failed:", error_1);
                        if (error_1.logs) {
                            console.error("Logs:", error_1.logs);
                        }
                        return [2 /*return*/, false];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get tree config PDA
     */
    MenagerieMinter.prototype.getTreeConfigPDA = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([this.ADDRESSES.storageAccount.toBuffer()], BUBBLEGUM_PROGRAM_ID)];
                    case 1: return [2 /*return*/, (_a.sent())[0]];
                }
            });
        });
    };
    /**
     * Create mint instruction data buffer for the Menagerie program
     */
    MenagerieMinter.prototype.createMintInstructionData = function (nftIndex) {
        // The successful transaction instruction data is:
        // 738715186c2d5fe40000000080b2e60e000000000100000000010001
        // Use the exact byte pattern that works in the successful transactions
        return Buffer.from([
            // Instruction discriminator (fixed)
            0x73, 0x87, 0x15, 0x18, 0x6c, 0x2d, 0x5f, 0xe4,
            // NFT index bytes - using exact pattern from successful transaction
            0x00, 0x00, 0x00, 0x00, 0x80, 0xb2, 0xe6, 0x0e,
            // Remaining fixed bytes
            0x00, 0x00, 0x00, 0x00,
            0x01, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x01
        ]);
    };
    /**
     * Create the mint instruction with all accounts needed
     */
    MenagerieMinter.prototype.createMintInstruction = function (nftIndex, nftMintKeypair) {
        // Create an ATA for the NFT - this will be created during the transaction
        var tokenAccount = web3_js_1.PublicKey.findProgramAddressSync([
            this.wallet.publicKey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            nftMintKeypair.publicKey.toBuffer()
        ], ASSOCIATED_TOKEN_PROGRAM_ID)[0];
        console.log("Token Account (ATA): ".concat(tokenAccount.toString()));
        console.log("NFT Mint: ".concat(nftMintKeypair.publicKey.toString()));
        return new web3_js_1.TransactionInstruction({
            programId: MENAGERIE_PROGRAM_ID,
            keys: [
                // The exact order and list of accounts from the successful transaction
                { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // #1 Wallet
                { pubkey: tokenAccount, isSigner: false, isWritable: true }, // #2 Token Account (ATA)
                { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // #3 Wallet again
                { pubkey: nftMintKeypair.publicKey, isSigner: true, isWritable: true }, // #4 Mint
                { pubkey: this.ADDRESSES.royaltyAddress, isSigner: false, isWritable: true }, // #5 Metadata
                { pubkey: this.ADDRESSES.metadataAddress, isSigner: false, isWritable: true }, // #6 Master Edition
                { pubkey: this.ADDRESSES.updateAuthorityAddress, isSigner: false, isWritable: true }, // #7 Update Authority
                { pubkey: this.ADDRESSES.storageAccount, isSigner: false, isWritable: true }, // #8 Storage Account
                { pubkey: this.ADDRESSES.paymentReceiver1, isSigner: false, isWritable: true }, // #9 Payment Receiver 1
                { pubkey: this.ADDRESSES.paymentReceiver3, isSigner: false, isWritable: true }, // #10 Payment Receiver 3
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false }, // #11 System Program
                { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false }, // #12 Menagerie Program
                { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false }, // #13 Menagerie Program
                { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false }, // #14 Menagerie Program
                { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false }, // #15 Menagerie Program
                { pubkey: web3_js_1.SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // #16 Instructions Sysvar
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // #17 Token Program
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // #18 Associated Token Program
                { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false }, // #19 Metadata Program
                { pubkey: COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false }, // #20 Compression Program
                { pubkey: SPL_NOOP_ID, isSigner: false, isWritable: false }, // #21 SPL Noop
                { pubkey: web3_js_1.SYSVAR_SLOT_HASHES_PUBKEY, isSigner: false, isWritable: false }, // #22 Slot Hashes Sysvar
                { pubkey: BUBBLEGUM_PROGRAM_ID, isSigner: false, isWritable: false }, // #23 Bubblegum Program
                { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false }, // #24 Menagerie Program
                { pubkey: MENAGERIE_PROGRAM_ID, isSigner: false, isWritable: false }, // #25 Menagerie Program
                { pubkey: this.ADDRESSES.collectionMint, isSigner: false, isWritable: false }, // #26 Collection Mint
                { pubkey: this.ADDRESSES.collectionMetadata, isSigner: false, isWritable: true }, // #27 Collection Metadata
                { pubkey: this.ADDRESSES.collectionMasterEdition, isSigner: false, isWritable: false }, // #28 Collection Master Edition
                { pubkey: this.ADDRESSES.delegateRecord, isSigner: false, isWritable: false }, // #29 Delegate Record
                { pubkey: this.ADDRESSES.tokenRecord, isSigner: false, isWritable: true }, // #30 Token Record
                { pubkey: TOKEN_AUTH_RULES_ID, isSigner: false, isWritable: false }, // #31 Token Auth Rules Program
                { pubkey: this.ADDRESSES.authRules, isSigner: false, isWritable: false }, // #32 Auth Rules
                { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // #33 Token 2022 Program
                { pubkey: this.ADDRESSES.paymentReceiver1, isSigner: false, isWritable: true }, // #34 Payment Receiver 1 again
                { pubkey: this.ADDRESSES.paymentReceiver2, isSigner: false, isWritable: true }, // #35 Payment Receiver 2
                // Additional accounts from the transaction log
                { pubkey: new web3_js_1.PublicKey("8X7Wn6hs9sSPAzH6gmrY25ewE8a5Bp6CquMCSEshGTef"), isSigner: false, isWritable: true } // #36 Additional account
            ],
            data: this.createMintInstructionData(nftIndex)
        });
    };
    /**
     * Create a complete mint transaction
     */
    MenagerieMinter.prototype.createMintTransaction = function (nftIndex, nftMintKeypair, options) {
        return __awaiter(this, void 0, void 0, function () {
            var computeUnits, computeUnitPrice, includeTip, tipAmount, transaction, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        computeUnits = (options === null || options === void 0 ? void 0 : options.computeUnits) || DEFAULT_COMPUTE_UNITS;
                        computeUnitPrice = (options === null || options === void 0 ? void 0 : options.computeUnitPrice) || DEFAULT_COMPUTE_PRICE;
                        includeTip = (options === null || options === void 0 ? void 0 : options.includeTip) !== false;
                        tipAmount = ((options === null || options === void 0 ? void 0 : options.tipAmount) || DEFAULT_TIP_AMOUNT) * web3_js_1.LAMPORTS_PER_SOL;
                        transaction = new web3_js_1.Transaction();
                        // Add mint instruction - this will handle the ATA internally
                        transaction.add(this.createMintInstruction(nftIndex, nftMintKeypair));
                        // Add tip transaction if requested
                        if (includeTip) {
                            transaction.add(web3_js_1.SystemProgram.transfer({
                                fromPubkey: this.wallet.publicKey,
                                toPubkey: this.ADDRESSES.tipAddress,
                                lamports: tipAmount
                            }));
                        }
                        // Set recent blockhash and fee payer
                        _a = transaction;
                        return [4 /*yield*/, this.connection.getLatestBlockhash()];
                    case 1:
                        // Set recent blockhash and fee payer
                        _a.recentBlockhash = (_b.sent()).blockhash;
                        transaction.feePayer = this.wallet.publicKey;
                        return [2 /*return*/, transaction];
                }
            });
        });
    };
    /**
     * Mint a Menagerie NFT
     */
    MenagerieMinter.prototype.mintNFT = function (nftIndex, options) {
        return __awaiter(this, void 0, void 0, function () {
            var rarityCheck, nftMintKeypair, transaction, signature, error_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("Minting Menagerie NFT #".concat(nftIndex));
                        if (!this.rarityProgram) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.checkRarity(nftIndex, options === null || options === void 0 ? void 0 : options.minRarityPercentage)];
                    case 1:
                        rarityCheck = _b.sent();
                        if (!rarityCheck) {
                            throw new Error("NFT #".concat(nftIndex, " does not meet minimum rarity threshold"));
                        }
                        _b.label = 2;
                    case 2:
                        nftMintKeypair = web3_js_1.Keypair.generate();
                        return [4 /*yield*/, this.createMintTransaction(nftIndex, nftMintKeypair, options)];
                    case 3:
                        transaction = _b.sent();
                        _b.label = 4;
                    case 4:
                        _b.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.connection.sendTransaction(transaction, [this.wallet, nftMintKeypair], { skipPreflight: (_a = options === null || options === void 0 ? void 0 : options.skipPreflight) !== null && _a !== void 0 ? _a : true })];
                    case 5:
                        signature = _b.sent();
                        console.log("Minted Menagerie NFT with signature: ".concat(signature));
                        console.log("NFT Mint: ".concat(nftMintKeypair.publicKey.toString()));
                        return [2 /*return*/, {
                                signature: signature,
                                nftMint: nftMintKeypair.publicKey
                            }];
                    case 6:
                        error_2 = _b.sent();
                        console.error("Error minting Menagerie NFT:", error_2);
                        if (error_2.logs) {
                            console.error("Transaction logs:", error_2.logs);
                        }
                        throw error_2;
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Batch mint multiple NFTs
     */
    MenagerieMinter.prototype.batchMintNFTs = function (startIndex, count, options) {
        return __awaiter(this, void 0, void 0, function () {
            var concurrentBatchSize, results, _loop_1, i;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        concurrentBatchSize = (options === null || options === void 0 ? void 0 : options.concurrentBatchSize) || 5;
                        results = [];
                        _loop_1 = function (i) {
                            var batchSize, batchPromises, batchResults, validResults;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        batchSize = Math.min(concurrentBatchSize, count - i);
                                        batchPromises = Array.from({ length: batchSize }, function (_, idx) {
                                            return _this.mintNFT(startIndex + i + idx, options)
                                                .catch(function (error) {
                                                console.error("Error minting NFT #".concat(startIndex + i + idx, ":"), error);
                                                return null;
                                            });
                                        });
                                        return [4 /*yield*/, Promise.all(batchPromises)];
                                    case 1:
                                        batchResults = _b.sent();
                                        validResults = batchResults.filter(function (result) { return result !== null; });
                                        results.push.apply(results, validResults);
                                        if (!(i + concurrentBatchSize < count)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                                    case 2:
                                        _b.sent();
                                        _b.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        };
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < count)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(i)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        i += concurrentBatchSize;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Submit mint transaction to JITO bundles if JITO endpoint is configured
     */
    MenagerieMinter.prototype.submitToJito = function (transaction, signers) {
        return __awaiter(this, void 0, void 0, function () {
            var serializedTransaction, response, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.jitoEndpoint) {
                            throw new Error("JITO endpoint not configured");
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Sign transaction
                        transaction.sign.apply(transaction, signers);
                        serializedTransaction = transaction.serialize();
                        return [4 /*yield*/, axios_1.default.post(this.jitoEndpoint, {
                                jsonrpc: "2.0",
                                id: 1,
                                method: "sendBundle",
                                params: [
                                    [serializedTransaction.toString('base64')],
                                    {
                                        maxTimeout: 60000,
                                    },
                                ],
                            })];
                    case 2:
                        response = _a.sent();
                        if (response.data.error) {
                            console.error("JITO error:", response.data.error);
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, response.data.result];
                    case 3:
                        error_3 = _a.sent();
                        console.error("Error submitting to JITO:", error_3);
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return MenagerieMinter;
}());
exports.MenagerieMinter = MenagerieMinter;
/**
 * Class for indexing and calculating rarity scores for Menagerie NFTs
 */
var MenagerieRarityIndexer = /** @class */ (function () {
    function MenagerieRarityIndexer(connection, wallet, merkleTreePubkey, options) {
        // Maps to store frequencies and calculated rarity scores
        this.attributeFrequencies = new Map();
        this.metadataByIndex = new Map();
        this.rarityScores = new Map();
        this.totalIndexed = 0;
        this.batchSize = 50;
        this.connection = connection;
        this.wallet = wallet;
        this.merkleTreePubkey = merkleTreePubkey;
        if (options === null || options === void 0 ? void 0 : options.batchSize) {
            this.batchSize = options.batchSize;
        }
        // Initialize the rarity program
        try {
            var walletAdapter = new anchor_1.Wallet(wallet);
            var provider = new anchor_1.AnchorProvider(connection, walletAdapter, { commitment: 'confirmed', skipPreflight: true });
            // @ts-ignore
            this.rarityProgram = new anchor_1.Program(idl, NFTING_PROGRAM_ID, provider);
            console.log("Rarity assessment program initialized");
        }
        catch (error) {
            console.warn("Could not initialize rarity program, continuing without it:", error);
        }
    }
    /**
     * Fetch metadata for a specific index
     */
    MenagerieRarityIndexer.prototype.fetchNFTMetadata = function (index) {
        return __awaiter(this, void 0, void 0, function () {
            var uri, response, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        uri = "".concat(IPFS_METADATA_BASE_URI, "/").concat(index, ".json");
                        return [4 /*yield*/, axios_1.default.get(uri)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_4 = _a.sent();
                        console.error("Error fetching metadata for index ".concat(index, ":"), error_4);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Index NFT metadata in batches
     */
    MenagerieRarityIndexer.prototype.indexMetadataBatch = function (startIndex, count) {
        return __awaiter(this, void 0, void 0, function () {
            var promises, results, _i, results_1, _a, index, metadata;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("Indexing batch from ".concat(startIndex, " to ").concat(startIndex + count - 1, "..."));
                        promises = Array.from({ length: count }, function (_, i) {
                            var index = startIndex + i;
                            return _this.fetchNFTMetadata(index)
                                .then(function (metadata) { return ({ index: index, metadata: metadata }); })
                                .catch(function () { return ({ index: index, metadata: null }); });
                        });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        results = _b.sent();
                        for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                            _a = results_1[_i], index = _a.index, metadata = _a.metadata;
                            if (metadata) {
                                this.metadataByIndex.set(index, metadata);
                                this.totalIndexed++;
                            }
                        }
                        console.log("Indexed ".concat(this.totalIndexed, " NFTs so far."));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Index all metadata up to a specified count
     */
    MenagerieRarityIndexer.prototype.indexAllMetadata = function (totalCount) {
        return __awaiter(this, void 0, void 0, function () {
            var i, batchCount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("Starting to index ".concat(totalCount, " NFTs..."));
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < totalCount)) return [3 /*break*/, 5];
                        batchCount = Math.min(this.batchSize, totalCount - i);
                        return [4 /*yield*/, this.indexMetadataBatch(i, batchCount)];
                    case 2:
                        _a.sent();
                        if (!(i + this.batchSize < totalCount)) return [3 /*break*/, 4];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        i += this.batchSize;
                        return [3 /*break*/, 1];
                    case 5:
                        // After all metadata is indexed, calculate frequencies and scores
                        this.calculateAttributeFrequencies();
                        this.calculateRarityScores();
                        console.log("Successfully indexed and calculated rarity for ".concat(this.totalIndexed, " NFTs."));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate frequency of each attribute value
     */
    MenagerieRarityIndexer.prototype.calculateAttributeFrequencies = function () {
        var _this = this;
        console.log("Calculating attribute frequencies...");
        this.attributeFrequencies.clear();
        // Count occurrences of each attribute
        this.metadataByIndex.forEach(function (metadata) {
            metadata.attributes.forEach(function (attribute) {
                var trait_type = attribute.trait_type, value = attribute.value;
                var valueStr = String(value);
                if (!_this.attributeFrequencies.has(trait_type)) {
                    _this.attributeFrequencies.set(trait_type, new Map());
                }
                var traitValues = _this.attributeFrequencies.get(trait_type);
                traitValues.set(valueStr, (traitValues.get(valueStr) || 0) + 1);
            });
        });
        // Print some debug info
        this.attributeFrequencies.forEach(function (values, trait) {
            console.log("Trait \"".concat(trait, "\" has ").concat(values.size, " unique values"));
        });
    };
    /**
     * Calculate statistical rarity scores for each NFT
     */
    MenagerieRarityIndexer.prototype.calculateRarityScores = function () {
        var _this = this;
        console.log("Calculating statistical rarity scores...");
        var totalNFTs = this.metadataByIndex.size;
        // First pass - calculate raw rarity scores
        var rawScores = new Map();
        this.metadataByIndex.forEach(function (metadata, index) {
            var score = 0;
            metadata.attributes.forEach(function (attribute) {
                var trait_type = attribute.trait_type, value = attribute.value;
                var valueStr = String(value);
                // Get frequency of this trait value
                var traitFrequencies = _this.attributeFrequencies.get(trait_type);
                if (!traitFrequencies)
                    return;
                var frequency = traitFrequencies.get(valueStr) || 0;
                if (frequency === 0)
                    return;
                // Rarity score for this trait = 1 / frequency percentage
                var traitScore = 1 / (frequency / totalNFTs);
                score += traitScore;
            });
            rawScores.set(index, score);
        });
        // Normalize scores to 0-100 range
        var scores = Array.from(rawScores.values());
        var minScore = Math.min.apply(Math, scores);
        var maxScore = Math.max.apply(Math, scores);
        var range = maxScore - minScore;
        rawScores.forEach(function (score, index) {
            // Use min-max scaling to normalize to 0-100
            var normalizedScore = range === 0
                ? 50 // If all have same rarity
                : Math.min(100, Math.round(((score - minScore) / range) * 100));
            _this.rarityScores.set(index, normalizedScore);
        });
        console.log("Normalized ".concat(this.rarityScores.size, " rarity scores from ").concat(minScore.toFixed(2), " to ").concat(maxScore.toFixed(2)));
    };
    /**
     * Initialize the NFT Beater program state
     */
    MenagerieRarityIndexer.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rarityState, rarityThresholds, error_5;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.rarityProgram) {
                            throw new Error("Rarity program not initialized");
                        }
                        console.log('Initializing NFT Beater state...');
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([
                                Buffer.from('nft-beater'),
                                this.merkleTreePubkey.toBuffer(),
                            ], NFTING_PROGRAM_ID)];
                    case 2:
                        rarityState = (_b.sent())[0];
                        rarityThresholds = [50, 75, 90];
                        return [4 /*yield*/, this.rarityProgram.methods
                                .initialize(this.merkleTreePubkey, Buffer.from(rarityThresholds))
                                .accounts({
                                state: rarityState,
                                merkleTreeAccount: this.merkleTreePubkey,
                                authority: this.wallet.publicKey,
                                feeReceiver: new web3_js_1.PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
                                systemProgram: web3_js_1.SystemProgram.programId,
                            })
                                .signers([this.wallet])
                                .rpc()];
                    case 3:
                        _b.sent();
                        console.log('NFT Beater state initialized successfully');
                        return [3 /*break*/, 5];
                    case 4:
                        error_5 = _b.sent();
                        // If account already initialized, we can proceed
                        if ((_a = error_5 === null || error_5 === void 0 ? void 0 : error_5.message) === null || _a === void 0 ? void 0 : _a.includes('already in use')) {
                            console.log('NFT Beater state already initialized');
                            return [2 /*return*/];
                        }
                        throw error_5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Store all calculated rarity scores on-chain
     */
    MenagerieRarityIndexer.prototype.updateOnChainRarityData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rarityState, maxIndex, rarityData, chunkSize, i, chunk, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.rarityProgram) {
                            throw new Error("Rarity program not initialized");
                        }
                        if (this.rarityScores.size === 0) {
                            throw new Error("No rarity scores calculated. Run indexAllMetadata first.");
                        }
                        console.log('Updating on-chain rarity data...');
                        // Ensure state is initialized
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        // Ensure state is initialized
                        _a.sent();
                        return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([
                                Buffer.from('nft-beater'),
                                this.merkleTreePubkey.toBuffer(),
                            ], NFTING_PROGRAM_ID)];
                    case 2:
                        rarityState = (_a.sent())[0];
                        maxIndex = Math.max.apply(Math, this.rarityScores.keys());
                        rarityData = Array(maxIndex + 1).fill(0);
                        // Fill in the scores we have
                        this.rarityScores.forEach(function (score, index) {
                            rarityData[index] = Math.floor(score);
                        });
                        chunkSize = 50;
                        i = 0;
                        _a.label = 3;
                    case 3:
                        if (!(i < rarityData.length)) return [3 /*break*/, 10];
                        chunk = rarityData.slice(i, i + chunkSize);
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this.rarityProgram.methods
                                .updateRarityData(new anchor_1.BN(i), Buffer.from(chunk))
                                .accounts({
                                state: rarityState,
                                authority: this.wallet.publicKey,
                                feeReceiver: new web3_js_1.PublicKey("89VB5UmvopuCFmp5Mf8YPX28fGvvqn79afCgouQuPyhY"),
                                systemProgram: web3_js_1.SystemProgram.programId,
                            })
                                .signers([this.wallet])
                                .rpc()];
                    case 5:
                        _a.sent();
                        console.log("Updated rarity data for indices ".concat(i, " to ").concat(i + chunk.length - 1));
                        return [3 /*break*/, 7];
                    case 6:
                        error_6 = _a.sent();
                        console.error("Error updating rarity data for chunk ".concat(i, ":"), error_6);
                        throw error_6;
                    case 7:
                        if (!(i + chunkSize < rarityData.length)) return [3 /*break*/, 9];
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9:
                        i += chunkSize;
                        return [3 /*break*/, 3];
                    case 10:
                        console.log('Rarity data updated on-chain successfully');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get rarity score for a specific NFT
     */
    MenagerieRarityIndexer.prototype.getRarityScore = function (index) {
        var score = this.rarityScores.get(index);
        if (score === undefined) {
            console.warn("No rarity score found for index ".concat(index));
            return 0;
        }
        return score;
    };
    /**
     * Save rarity data to a JSON file
     */
    MenagerieRarityIndexer.prototype.saveRarityData = function (filePath) {
        var _this = this;
        var data = {
            totalNFTs: this.totalIndexed,
            rarityScores: Array.from(this.rarityScores.entries()).map(function (_a) {
                var index = _a[0], score = _a[1];
                return ({
                    index: index,
                    score: score,
                    metadata: _this.metadataByIndex.get(index),
                });
            }),
        };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log("Rarity data saved to ".concat(filePath));
    };
    return MenagerieRarityIndexer;
}());
exports.MenagerieRarityIndexer = MenagerieRarityIndexer;
// Update the main function to use the rarity indexer and minter
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, wallet, command, merkleTreePubkey, indexer, totalToIndex, nftIndex, minter, testMintKeypair, testTokenAccount, instructionData, _a, signature, nftMint, tokenAccount, confirmation, nftMetadata, metadataError_1, confirmError_1, error_7;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    connection = new web3_js_1.Connection("https://api.mainnet-beta.solana.com", "confirmed");
                    wallet = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.resolve(process.env.KEYPAIR_PATH || '/Users/jarettdunn/ddgb.json'), 'utf-8'))));
                    command = process.argv[2] || 'mint';
                    if (!(command === 'index-rarities')) return [3 /*break*/, 3];
                    // Use the rarity indexer to calculate and store rarities
                    console.log("Starting to index NFT collection and calculate rarities...");
                    merkleTreePubkey = new web3_js_1.PublicKey("44xq2PwsXAWk3vsYbPKvXv9EmxjebCYqCshAtToa43NH");
                    indexer = new MenagerieRarityIndexer(connection, wallet, merkleTreePubkey);
                    totalToIndex = parseInt(process.argv[3] || '100');
                    return [4 /*yield*/, indexer.indexAllMetadata(totalToIndex)];
                case 1:
                    _b.sent();
                    // Save rarity data to file
                    indexer.saveRarityData('menagerie-rarities.json');
                    // Update on-chain rarity data
                    return [4 /*yield*/, indexer.updateOnChainRarityData()];
                case 2:
                    // Update on-chain rarity data
                    _b.sent();
                    console.log("Rarity indexing complete!");
                    return [2 /*return*/];
                case 3:
                    nftIndex = parseInt(process.argv[3] || '4489');
                    minter = new MenagerieMinter(connection, wallet, {
                    // Uncomment to enable JITO integration
                    // jitoEndpoint: "https://jito-relayer-mainnet.block-engine.jito.wtf"
                    });
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 15, , 16]);
                    console.log("Preparing to mint NFT with index: ".concat(nftIndex));
                    console.log("Wallet address: ".concat(wallet.publicKey.toString()));
                    testMintKeypair = web3_js_1.Keypair.generate();
                    testTokenAccount = web3_js_1.PublicKey.findProgramAddressSync([
                        wallet.publicKey.toBuffer(),
                        TOKEN_PROGRAM_ID.toBuffer(),
                        testMintKeypair.publicKey.toBuffer()
                    ], ASSOCIATED_TOKEN_PROGRAM_ID)[0];
                    console.log("Test mint: ".concat(testMintKeypair.publicKey.toString()));
                    console.log("Test ATA: ".concat(testTokenAccount.toString()));
                    instructionData = minter['createMintInstructionData'](nftIndex);
                    console.log("Instruction Data (hex):", Buffer.from(instructionData).toString('hex'));
                    console.log("Expected Data (hex):   ", "738715186c2d5fe40000000080b2e60e000000000100000000010001");
                    return [4 /*yield*/, minter.mintNFT(nftIndex, {
                            computeUnits: 525000, // Use 525,000 as in successful transaction
                            computeUnitPrice: 58767, // Use 58767 as in successful transaction
                            skipPreflight: true, // Skip preflight checks to avoid client-side validation
                            minRarityPercentage: 20 // Only mint if NFT meets minimum rarity threshold
                        })];
                case 5:
                    _a = _b.sent(), signature = _a.signature, nftMint = _a.nftMint;
                    console.log("Transaction sent successfully!");
                    console.log("Signature:", signature);
                    console.log("NFT Mint:", nftMint.toString());
                    console.log("View on Solana Explorer:", "https://explorer.solana.com/tx/".concat(signature));
                    tokenAccount = web3_js_1.PublicKey.findProgramAddressSync([
                        wallet.publicKey.toBuffer(),
                        TOKEN_PROGRAM_ID.toBuffer(),
                        nftMint.toBuffer()
                    ], ASSOCIATED_TOKEN_PROGRAM_ID)[0];
                    console.log("Token Account (ATA):", tokenAccount.toString());
                    // Optionally wait for confirmation
                    console.log("Waiting for transaction confirmation...");
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 13, , 14]);
                    return [4 /*yield*/, connection.confirmTransaction(signature, 'confirmed')];
                case 7:
                    confirmation = _b.sent();
                    if (!confirmation.value.err) return [3 /*break*/, 8];
                    console.error("Transaction confirmed but has errors:", confirmation.value.err);
                    return [3 /*break*/, 12];
                case 8:
                    console.log("Menagerie NFT minted and confirmed successfully!");
                    // Try to get the NFT token data 
                    console.log("Fetching on-chain NFT data...");
                    _b.label = 9;
                case 9:
                    _b.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, connection.getAccountInfo(web3_js_1.PublicKey.findProgramAddressSync([
                            Buffer.from('metadata'),
                            METADATA_PROGRAM_ID.toBuffer(),
                            nftMint.toBuffer()
                        ], METADATA_PROGRAM_ID)[0])];
                case 10:
                    nftMetadata = _b.sent();
                    if (nftMetadata) {
                        console.log("NFT metadata found on-chain");
                    }
                    return [3 /*break*/, 12];
                case 11:
                    metadataError_1 = _b.sent();
                    console.warn("Could not fetch NFT metadata:", metadataError_1);
                    return [3 /*break*/, 12];
                case 12: return [3 /*break*/, 14];
                case 13:
                    confirmError_1 = _b.sent();
                    console.warn("Could not confirm transaction, but it might still succeed:", confirmError_1);
                    return [3 /*break*/, 14];
                case 14: return [3 /*break*/, 16];
                case 15:
                    error_7 = _b.sent();
                    console.error("Error:", error_7);
                    return [3 /*break*/, 16];
                case 16: return [2 /*return*/];
            }
        });
    });
}
// Run the example if this file is executed directly
if (require.main === module) {
    main().then(function () { return process.exit(0); }, function (error) {
        console.error(error);
        process.exit(1);
    });
}
