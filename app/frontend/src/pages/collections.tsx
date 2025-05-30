import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Sparkles, 
  Search, 
  Plus, 
  Loader2, 
  CheckCircle2,
  XCircle,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { collectionApi, rarityApi, deserializeTransaction } from '@/lib/api'
import { PublicKey } from '@solana/web3.js'

export default function Collections() {
  const { publicKey, sendTransaction } = useWallet()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Example collections - in production, these would come from your backend
  const exampleCollections = [
    { address: 'Qmd2mt5hpF9d9QMDhpX9SecoPsvdpqcGVnP7ETfxB6hrr3', name: 'Example Collection', totalSupply: 1000 }
  ]

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
            <Link href="/collections" className="text-primary-400 font-semibold">
              Collections
            </Link>
            <Link href="/mint" className="text-white hover:text-primary-400 transition">
              Mint
            </Link>
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-6">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">NFT Collections</h1>
            <p className="text-gray-400">Browse and manage collections with on-chain rarity verification</p>
          </div>

          {/* Search and Add */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by collection address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg 
                         text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
              />
            </div>
            {publicKey && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg 
                         font-semibold flex items-center space-x-2 transition"
              >
                <Plus className="w-5 h-5" />
                <span>Add Collection</span>
              </button>
            )}
          </div>

          {/* Collections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exampleCollections.map((collection) => (
              <CollectionCard
                key={collection.address}
                address={collection.address}
                onSelect={() => setSelectedCollection(collection.address)}
              />
            ))}
          </div>

          {/* Add Collection Modal */}
          {showAddModal && (
            <AddCollectionModal
              onClose={() => setShowAddModal(false)}
              walletAddress={publicKey?.toString() || ''}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function CollectionCard({ address, onSelect }: { address: string; onSelect: () => void }) {
  const { data: collectionInfo, isLoading } = useQuery({
    queryKey: ['collection', address],
    queryFn: () => collectionApi.getInfo(address),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-1/2"></div>
      </div>
    )
  }

  const isIndexed = collectionInfo?.isInitialized
  const progress = collectionInfo?.indexingProgress

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-primary-600 
                 transition-all cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-white">
          {collectionInfo?.name || 'Unknown Collection'}
        </h3>
        {isIndexed ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-gray-500" />
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Total Supply:</span>
          <span className="text-white">{collectionInfo?.totalSupply || 'Unknown'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Status:</span>
          <span className={isIndexed ? 'text-green-500' : 'text-yellow-500'}>
            {isIndexed ? 'Indexed' : 'Not Indexed'}
          </span>
        </div>
        {progress && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Indexing Progress</span>
              <span className="text-white">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex space-x-2">
        <button className="flex-1 py-2 px-3 bg-gray-700 hover:bg-gray-600 rounded-lg 
                         text-white text-sm transition flex items-center justify-center space-x-1">
          <BarChart3 className="w-4 h-4" />
          <span>Stats</span>
        </button>
        <button className="flex-1 py-2 px-3 bg-primary-600 hover:bg-primary-700 rounded-lg 
                         text-white text-sm transition flex items-center justify-center space-x-1">
          <RefreshCw className="w-4 h-4" />
          <span>Sync</span>
        </button>
      </div>
    </motion.div>
  )
}

function AddCollectionModal({ 
  onClose, 
  walletAddress 
}: { 
  onClose: () => void
  walletAddress: string 
}) {
  const { sendTransaction } = useWallet()
  const { connection } = useConnection()
  const [collectionAddress, setCollectionAddress] = useState('')
  const [ipfsHash, setIpfsHash] = useState('')
  const [totalSupply, setTotalSupply] = useState('')
  const [isInitializing, setIsInitializing] = useState(false)

  const handleInitialize = async () => {
    if (!collectionAddress || !ipfsHash || !totalSupply) {
      toast.error('Please fill in all fields')
      return
    }

    setIsInitializing(true)
    try {
      // First, initialize on-chain
      const { transaction } = await collectionApi.getInitializeTransaction(
        walletAddress,
        collectionAddress,
        [50, 75, 90] // Default rarity thresholds
      )

      const tx = deserializeTransaction(transaction)
      const signature = await sendTransaction(tx, connection)
      await connection.confirmTransaction(signature)

      toast.success('Collection initialized on-chain!')

      // Then start indexing
      await collectionApi.indexCollection(
        collectionAddress,
        ipfsHash,
        parseInt(totalSupply)
      )

      toast.success('Indexing started!')
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Failed to initialize collection')
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-xl p-6 max-w-md w-full"
      >
        <h2 className="text-2xl font-bold text-white mb-4">Add New Collection</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Collection Address (Merkle Tree)
            </label>
            <input
              type="text"
              value={collectionAddress}
              onChange={(e) => setCollectionAddress(e.target.value)}
              placeholder="Enter Solana address..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              IPFS Hash
            </label>
            <input
              type="text"
              value={ipfsHash}
              onChange={(e) => setIpfsHash(e.target.value)}
              placeholder="Qm..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Total Supply
            </label>
            <input
              type="number"
              value={totalSupply}
              onChange={(e) => setTotalSupply(e.target.value)}
              placeholder="1000"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                       text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg 
                     text-white font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleInitialize}
            disabled={isInitializing}
            className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 rounded-lg 
                     text-white font-semibold transition disabled:opacity-50 
                     disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isInitializing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Initialize & Index</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
} 