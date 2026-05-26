import { useEffect, useRef, useState } from 'react'
import { X, Download, Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { api } from '../api'

interface VideoPreviewModalProps {
  isOpen: boolean
  videoUrl: string
  filename: string
  title?: string
  onClose: () => void
}

export default function VideoPreviewModal({
  isOpen,
  videoUrl,
  filename,
  title = 'Preview',
  onClose,
}: VideoPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
      // Auto-play when opened
      setTimeout(() => {
        videoRef.current?.play()
      }, 300)
    } else {
      setIsVisible(false)
      videoRef.current?.pause()
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await api.downloadFile(videoUrl, filename)
    } finally {
      setIsDownloading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4
        transition-all duration-300
        ${isVisible ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/0'}
      `}
      onClick={onClose}
    >
      <div
        className={`
          bg-slate-900 rounded-xl border border-slate-700 shadow-2xl
          w-full max-w-4xl overflow-hidden
          transition-all duration-300
          ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            src={api.getDownloadUrl(videoUrl)}
            className="w-full h-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onClick={togglePlay}
            playsInline
          />
          
          {/* Play/Pause overlay */}
          <div 
            className="absolute inset-0 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
            onClick={togglePlay}
          >
            <div className="bg-black/50 rounded-full p-4">
              {isPlaying ? (
                <Pause className="w-12 h-12 text-white" />
              ) : (
                <Play className="w-12 h-12 text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/50 border-t border-slate-700">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white font-medium transition-all"
            >
              <Download className="w-5 h-5" />
              {isDownloading ? 'Downloading...' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
