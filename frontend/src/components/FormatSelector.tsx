import { useState } from 'react'
import { 
  Smartphone, 
  Monitor, 
  Square, 
  RectangleHorizontal,
  Sparkles,
  Clock,
  Check
} from 'lucide-react'
import { VideoFormat } from '../types'

// Social media format presets
export const VIDEO_FORMATS: VideoFormat[] = [
  {
    id: 'original',
    name: 'Original',
    platform: 'Keep Original',
    aspectRatio: 'auto',
    width: 0,
    height: 0,
    icon: 'monitor'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    platform: 'TikTok / Reels',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    maxDuration: 180,
    icon: 'smartphone'
  },
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    platform: 'YouTube Shorts',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    maxDuration: 60,
    icon: 'smartphone'
  },
  {
    id: 'instagram-reel',
    name: 'Instagram Reel',
    platform: 'Instagram Reels',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    maxDuration: 90,
    icon: 'smartphone'
  },
  {
    id: 'instagram-feed',
    name: 'Instagram Feed',
    platform: 'Instagram Post',
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    icon: 'rectangle'
  },
  {
    id: 'instagram-square',
    name: 'Square',
    platform: 'Instagram / Facebook',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    icon: 'square'
  },
  {
    id: 'youtube',
    name: 'YouTube',
    platform: 'YouTube / Landscape',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    icon: 'monitor'
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    platform: 'Twitter / X',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    maxDuration: 140,
    icon: 'monitor'
  },
]

interface FormatSelectorProps {
  selectedFormat: string
  onFormatChange: (format: string) => void
  clipDuration: number
}

export default function FormatSelector({ selectedFormat, onFormatChange, clipDuration }: FormatSelectorProps) {
  const [showAll, setShowAll] = useState(false)
  
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'smartphone': return <Smartphone className="w-5 h-5" />
      case 'monitor': return <Monitor className="w-5 h-5" />
      case 'square': return <Square className="w-5 h-5" />
      case 'rectangle': return <RectangleHorizontal className="w-5 h-5" />
      default: return <Monitor className="w-5 h-5" />
    }
  }

  const selectedFormatData = VIDEO_FORMATS.find(f => f.id === selectedFormat)
  const displayFormats = showAll ? VIDEO_FORMATS : VIDEO_FORMATS.slice(0, 5)

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" />
        Export Format
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {displayFormats.map((format) => {
          const isSelected = selectedFormat === format.id
          const durationExceeds = format.maxDuration && clipDuration > format.maxDuration
          
          return (
            <button
              key={format.id}
              onClick={() => onFormatChange(format.id)}
              className={`
                relative p-3 rounded-lg border-2 transition-all text-left
                ${isSelected 
                  ? 'border-purple-500 bg-purple-500/10' 
                  : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                }
              `}
            >
              {isSelected && (
                <div className="absolute top-1 right-1">
                  <Check className="w-4 h-4 text-purple-400" />
                </div>
              )}
              <div className={`mb-1 ${isSelected ? 'text-purple-400' : 'text-slate-400'}`}>
                {getIcon(format.icon)}
              </div>
              <div className="text-white text-sm font-medium">{format.name}</div>
              <div className="text-slate-400 text-xs">{format.aspectRatio}</div>
              {format.maxDuration && (
                <div className={`text-xs mt-1 flex items-center gap-1 ${durationExceeds ? 'text-orange-400' : 'text-slate-500'}`}>
                  <Clock className="w-3 h-3" />
                  Max {format.maxDuration}s
                </div>
              )}
            </button>
          )
        })}
      </div>
      
      {!showAll && VIDEO_FORMATS.length > 5 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300"
        >
          Show more formats...
        </button>
      )}
      
      {selectedFormatData && selectedFormatData.id !== 'original' && (
        <div className="mt-3 p-2 bg-slate-700/50 rounded-lg">
          <div className="text-xs text-slate-400">
            Output: <span className="text-white">{selectedFormatData.width}x{selectedFormatData.height}</span>
            {selectedFormatData.maxDuration && clipDuration > selectedFormatData.maxDuration && (
              <span className="text-orange-400 ml-2">
                ⚠ Clip exceeds max duration ({selectedFormatData.maxDuration}s)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
