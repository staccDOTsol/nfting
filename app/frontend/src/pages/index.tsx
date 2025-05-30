import { motion } from 'framer-motion'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import Link from 'next/link'
import { Sparkles, Shield, Zap, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="glass-effect fixed top-0 w-full z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Sparkles className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">NFTing</span>
          </Link>
          <div className="flex items-center space-x-6">
            <Link href="/collections" className="text-white hover:text-primary-200 transition">
              Collections
            </Link>
            <Link href="/mint" className="text-white hover:text-primary-200 transition">
              Mint
            </Link>
            <WalletMultiButton className="!bg-white/20 hover:!bg-white/30" />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-6">
              Mint NFTs with
              <span className="block text-gradient">Assured Rarity</span>
            </h1>
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              The first on-chain rarity verification system for Solana NFTs. 
              Index collections, check rarities, and mint with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/collections">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white text-primary-700 rounded-lg font-semibold 
                           flex items-center space-x-2 hover:bg-white/90 transition shadow-xl"
                >
                  <span>Browse Collections</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
              <Link href="/mint">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 glass-effect text-white rounded-lg font-semibold 
                           flex items-center space-x-2 hover:bg-white/20 transition neon-glow"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Start Minting</span>
                </motion.button>
              </Link>
            </div>
          </motion.div>

          {/* Feature Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20"
          >
            <FeatureCard
              icon={<Shield className="w-12 h-12" />}
              title="On-Chain Verification"
              description="All rarity data is stored and verified on the Solana blockchain for complete transparency."
            />
            <FeatureCard
              icon={<Zap className="w-12 h-12" />}
              title="Lightning Fast"
              description="Index entire collections in minutes with our optimized metadata fetching system."
            />
            <FeatureCard
              icon={<Sparkles className="w-12 h-12" />}
              title="Rarity Guaranteed"
              description="Set minimum rarity thresholds and mint only the NFTs that meet your criteria."
            />
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="glass-effect rounded-2xl p-12"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
              <StatCard number="10K+" label="NFTs Indexed" />
              <StatCard number="50+" label="Collections" />
              <StatCard number="99.9%" label="Uptime" />
              <StatCard number="< 1s" label="Verification Time" />
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="glass-effect rounded-xl p-8 text-center card-hover"
    >
      <div className="text-white mb-4 flex justify-center">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/70">{description}</p>
    </motion.div>
  )
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-white mb-2">{number}</div>
      <div className="text-white/70">{label}</div>
    </div>
  )
} 