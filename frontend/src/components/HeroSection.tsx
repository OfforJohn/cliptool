import { Scissors, Sparkles, Zap, Share2, Wand2, CloudUpload } from 'lucide-react'

interface HeroSectionProps {
  onScrollToUpload: () => void
}

export default function HeroSection({ onScrollToUpload }: HeroSectionProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-slate-900 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      
      <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
        {/* Hero Content */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Video Editing</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Create Perfect Clips
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
              In Seconds
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Upload your video, let AI transcribe and detect scenes, then create professional clips with just a few clicks. No experience needed.
          </p>
          
          <button
            onClick={onScrollToUpload}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
          >
            <CloudUpload className="w-6 h-6" />
            Start Clipping Now
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          <FeatureCard
            icon={<Wand2 className="w-6 h-6" />}
            title="AI Transcription"
            description="Auto-transcribe audio with Whisper AI for easy text-based editing"
            gradient="from-blue-500 to-cyan-500"
          />
          <FeatureCard
            icon={<Scissors className="w-6 h-6" />}
            title="Scene Detection"
            description="Automatically detect scene changes to find the best clip points"
            gradient="from-purple-500 to-pink-500"
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Instant Processing"
            description="Fast server-side processing handles even large files quickly"
            gradient="from-orange-500 to-red-500"
          />
          <FeatureCard
            icon={<Share2 className="w-6 h-6" />}
            title="Cloud Storage"
            description="Videos saved to cloud with shareable links that never expire"
            gradient="from-green-500 to-emerald-500"
          />
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 py-8 border-y border-slate-700/50">
          <StatItem value="4K" label="Max Resolution" />
          <StatItem value="<5s" label="Processing Time" />
          <StatItem value="100%" label="Free to Use" />
          <StatItem value="∞" label="No Limits" />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  gradient 
}: { 
  icon: React.ReactNode
  title: string
  description: string
  gradient: string
}) {
  return (
    <div className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-all hover:-translate-y-1">
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} mb-4`}>
        {icon}
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-white mb-1">{value}</div>
      <div className="text-slate-500 text-sm">{label}</div>
    </div>
  )
}
