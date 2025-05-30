import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  Sparkles,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import { collectionApi, rarityApi, NFTWithRarity } from '@/lib/api'

export default function Mint() {
  const { publicKey, signTransaction } = useWallet()
  const [selectedCollection, setSelectedCollection] = useState<string>('')
  const [minRarity, setMinRarity] = useState(75)
  const [selectedNFT, setSelectedNFT] = useState<NFTWithRarity | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

  // Example collections - in production, fetch from backend
  const collections = [
    { address: 'Qmd2mt5hpF9d9QMDhpX9SecoPsvdpqcGVnP7ETfxB6hrr3', name: 'Example Collection' }
  ]

  // Fetch eligible NFTs
  const { data: rarityData, isLoading: loadingRarity } = useQuery({
    queryKey: ['rarity-check', selectedCollection, minRarity],
    queryFn: () => rarityApi.checkRarity(selectedCollection, undefined, minRarity),
    enabled: !!selectedCollection,
  })

  const eligibleNFTs = rarityData?.eligible || []
  const totalPages = Math.ceil(eligibleNFTs.length / itemsPerPage)
  const paginatedNFTs = eligibleNFTs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleMint = async () => {
    if (!selectedNFT || !publicKey) return

    try {
      toast.loading('Preparing mint transaction...')
      
      // In production, this would call the actual mint function
      // For now, we're just showing the flow
      toast.success(`Ready to mint ${selectedNFT.name}!`)
      
      // Here you would:
      // 1. Call your mint API endpoint
      // 2. Get the transaction
      // 3. Sign and send it
      // 4. Wait for confirmation
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to mint')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="glass-effect fixed top-0 w-full z-50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Sparkles className="w-8 h-8 text-primary-400" />
            <span className="text-2xl font-bold text-white">NFTing</span>
          </Link>
          <div className="flex items-center space-x-6">
            <Link href="/collections" className="text-white hover:text-primary-400 transition">
              Collections
            </Link>
            <Link href="/mint" className="text-primary-400 font-semibold">
              Mint
            </Link>
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-12 px-6">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Mint with Assured Rarity</h1>
            <p className="text-gray-400">Select your minimum rarity threshold and mint only the best NFTs</p>
          </div>

          {/* Controls */}
          <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Collection Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Select Collection
                </label>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg 
                           text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="">Choose a collection...</option>
                  {collections.map((col) => (
                    <option key={col.address} value={col.address}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rarity Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Minimum Rarity Score: {minRarity}%
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minRarity}
                    onChange={(e) => setMinRarity(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer 
                             slider-thumb"
                  />
                  <div className="text-white font-semibold w-12 text-right">{minRarity}%</div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Common</span>
                  <span>Rare</span>
                  <span>Legendary</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            {rarityData && (
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{rarityData.stats.eligibleCount}</div>
                  <div className="text-sm text-gray-400">Eligible NFTs</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">
                    {Math.round(rarityData.stats.averageRarity)}%
                  </div>
                  <div className="text-sm text-gray-400">Avg Rarity</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-400">
                    {eligibleNFTs.length > 0 ? eligibleNFTs[0].rarity.score : 0}%
                  </div>
                  <div className="text-sm text-gray-400">Top Rarity</div>
                </div>
              </div>
            )}
          </div>

          {/* NFT Grid */}
          {selectedCollection && (
            <>
              {loadingRarity ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
                </div>
              ) : eligibleNFTs.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No NFTs found with rarity ≥ {minRarity}%</p>
                  <p className="text-gray-500 text-sm mt-2">Try lowering your rarity threshold</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <AnimatePresence mode="wait">
                      {paginatedNFTs.map((nft: NFTWithRarity) => (
                        <NFTCard
                          key={nft.index}
                          nft={nft}
                          isSelected={selectedNFT?.index === nft.index}
                          onSelect={() => setSelectedNFT(nft)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-4 mt-8">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="p-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed
                                 hover:bg-gray-700 transition"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <span className="text-white">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed
                                 hover:bg-gray-700 transition"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Mint Button */}
          {selectedNFT && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed bottom-8 left-1/2 transform -translate-x-1/2"
            >
              <button
                onClick={handleMint}
                disabled={!publicKey}
                className="px-8 py-4 bg-gradient-to-r from-primary-600 to-accent-600 
                         text-white font-bold rounded-lg shadow-2xl neon-glow
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:scale-105 transition-transform flex items-center space-x-3"
              >
                <Zap className="w-6 h-6" />
                <span>Mint {selectedNFT.name}</span>
                <span className="text-sm opacity-80">({selectedNFT.rarity.score}% Rarity)</span>
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

function NFTCard({ 
  nft, 
  isSelected, 
  onSelect 
}: { 
  nft: NFTWithRarity
  isSelected: boolean
  onSelect: () => void 
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5 }}
      onClick={onSelect}
      className={`
        relative bg-gray-800 rounded-xl overflow-hidden cursor-pointer
        border-2 transition-all duration-300
        ${isSelected 
          ? 'border-primary-500 shadow-[0_0_30px_rgba(14,165,233,0.5)]' 
          : 'border-gray-700 hover:border-gray-600'
        }
      `}
    >
      {/* Rarity Badge */}
      <div className="absolute top-2 right-2 z-10">
        <div className={`
          px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm
          ${nft.rarity.score >= 90 
            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' 
            : nft.rarity.score >= 75
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              : 'bg-gray-700 text-gray-300'
          }
        `}>
          {nft.rarity.score}%
        </div>
      </div>

      {/* Image */}
      <div className="aspect-square bg-gray-700">
        {nft.image ? (
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sparkles className="w-16 h-16 text-gray-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white mb-1">{nft.name}</h3>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Rank #{nft.rarity.rank}</span>
          <span className="text-primary-400">Top {nft.rarity.percentile}%</span>
        </div>
      </div>

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-primary-400" />
        </div>
      )}
    </motion.div>
  )
}

// Custom CSS for the range slider
const sliderStyles = `
  .slider-thumb::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    background: #0ea5e9;
    cursor: pointer;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(14, 165, 233, 0.5);
  }
  
  .slider-thumb::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #0ea5e9;
    cursor: pointer;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(14, 165, 233, 0.5);
  }
`

// Add styles to head
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = sliderStyles
  document.head.appendChild(style)
} 