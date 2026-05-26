import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Download, Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
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
  const progressRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  
  const hideControlsTimeout = useRef<NodeJS.Timeout>()

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Reset controls hide timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current)
    }
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isPlaying])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true))
      document.body.style.overflow = 'hidden'
      setTimeout(() => {
        videoRef.current?.play()
      }, 300)
    } else {
      setIsVisible(false)
      videoRef.current?.pause()
      document.body.style.overflow = ''
      setProgress(0)
      setCurrentTime(0)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle escape key and fullscreen change
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isFullscreen) {
        onClose()
      }
      // Space to toggle play
      if (e.key === ' ' && isOpen) {
        e.preventDefault()
        togglePlay()
      }
      // Arrow keys for seeking
      if (e.key === 'ArrowLeft' && isOpen) {
        skip(-10)
      }
      if (e.key === 'ArrowRight' && isOpen) {
        skip(10)
      }
      // M for mute
      if (e.key === 'm' && isOpen) {
        toggleMute()
      }
      // F for fullscreen
      if (e.key === 'f' && isOpen) {
        toggleFullscreen()
      }
    }
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    window.addEventListener('keydown', handleEscape)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [isOpen, onClose, isFullscreen])

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

  const toggleFullscreen = async () => {
    if (!containerRef.current) return
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds))
    }
  }

  const restart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play()
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime
      const total = videoRef.current.duration
      setCurrentTime(current)
      setProgress((current / total) * 100)
      
      // Update buffered
      if (videoRef.current.buffered.length > 0) {
        setBuffered((videoRef.current.buffered.end(0) / total) * 100)
      }
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !videoRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    videoRef.current.currentTime = pos * duration
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
    if (videoRef.current) {
      videoRef.current.volume = vol
      setIsMuted(vol === 0)
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
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-300
        ${isVisible ? 'bg-black/95 backdrop-blur-md' : 'bg-black/0'}
      `}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className={`
          bg-gradient-to-b from-slate-900 to-slate-950 
          w-full h-full sm:h-auto sm:max-h-[95vh]
          sm:w-[95vw] sm:max-w-6xl sm:rounded-2xl 
          overflow-hidden shadow-2xl
          transition-all duration-300 ease-out
          flex flex-col
          ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
          ${isFullscreen ? '!rounded-none !max-w-none !max-h-none' : ''}
        `}
        onClick={e => e.stopPropagation()}
        onMouseMove={resetControlsTimer}
        onTouchStart={resetControlsTimer}
      >
        {/* Header - Hidden in fullscreen on desktop, always visible on mobile */}
        <div className={`
          flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 
          border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm
          transition-opacity duration-300
          ${isFullscreen && !showControls ? 'opacity-0' : 'opacity-100'}
        `}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-white truncate">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700/80 transition-all duration-200 group flex-shrink-0"
          >
            <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Video Player Container */}
        <div 
          className={`
            relative flex-1 bg-black flex items-center justify-center
            ${isFullscreen ? 'h-full' : 'aspect-video sm:aspect-video'}
          `}
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            src={api.getDownloadUrl(videoUrl)}
            className="w-full h-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
          
          {/* Center Play Button - Shows when paused */}
          <div 
            className={`
              absolute inset-0 flex items-center justify-center pointer-events-none
              transition-opacity duration-300
              ${isPlaying ? 'opacity-0' : 'opacity-100'}
            `}
          >
            <div className="bg-white/10 backdrop-blur-md rounded-full p-6 sm:p-8 border border-white/20 shadow-2xl">
              <Play className="w-12 h-12 sm:w-16 sm:h-16 text-white fill-white" />
            </div>
          </div>

          {/* Gradient overlays for controls visibility */}
          <div className={`
            absolute bottom-0 left-0 right-0 h-32 
            bg-gradient-to-t from-black/80 via-black/40 to-transparent
            pointer-events-none transition-opacity duration-300
            ${showControls ? 'opacity-100' : 'opacity-0'}
          `} />
        </div>

        {/* Progress Bar */}
        <div 
          ref={progressRef}
          className={`
            relative h-1.5 sm:h-2 bg-slate-800 cursor-pointer group
            transition-opacity duration-300
            ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}
          `}
          onClick={handleProgressClick}
        >
          {/* Buffered */}
          <div 
            className="absolute top-0 left-0 h-full bg-slate-600/50 transition-all"
            style={{ width: `${buffered}%` }}
          />
          {/* Progress */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
            style={{ width: `${progress}%` }}
          />
          {/* Hover effect */}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          {/* Scrubber */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg 
              opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
            style={{ left: `calc(${progress}% - 8px)` }}
          />
        </div>

        {/* Controls */}
        <div className={`
          flex flex-col sm:flex-row items-stretch sm:items-center justify-between 
          px-4 sm:px-6 py-3 sm:py-4 gap-3 sm:gap-4
          bg-gradient-to-t from-slate-900 to-slate-900/95
          transition-opacity duration-300
          ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}
        `}>
          {/* Left controls */}
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
            {/* Play controls group */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); restart() }}
                className="p-2 sm:p-2.5 rounded-full hover:bg-slate-700/80 transition-all active:scale-95"
                title="Restart (R)"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); skip(-10) }}
                className="p-2 sm:p-2.5 rounded-full hover:bg-slate-700/80 transition-all active:scale-95"
                title="Back 10s"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay() }}
                className="p-3 sm:p-3.5 rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95"
                title="Play/Pause (Space)"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                ) : (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white" />
                )}
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); skip(10) }}
                className="p-2 sm:p-2.5 rounded-full hover:bg-slate-700/80 transition-all active:scale-95"
                title="Forward 10s"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
              </button>
            </div>

            {/* Volume control */}
            <div 
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute() }}
                className="p-2 sm:p-2.5 rounded-full hover:bg-slate-700/80 transition-all"
                title="Mute (M)"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
                )}
              </button>
              
              {/* Volume slider - desktop only */}
              <div className={`
                hidden sm:flex items-center overflow-hidden transition-all duration-300
                ${showVolumeSlider ? 'w-20 opacity-100 ml-1' : 'w-0 opacity-0'}
              `}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 
                    [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </div>

            {/* Time display */}
            <div className="text-xs sm:text-sm text-slate-400 font-mono tabular-nums">
              <span className="text-white">{formatTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Right controls */}
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            {/* Fullscreen button - desktop only */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen() }}
              className="hidden sm:block p-2.5 rounded-full hover:bg-slate-700/80 transition-all"
              title="Fullscreen (F)"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-slate-300" />
              ) : (
                <Maximize className="w-5 h-5 text-slate-300" />
              )}
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="px-3 sm:px-4 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 
                text-white text-sm font-medium transition-all active:scale-95"
            >
              Close
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload() }}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl
                bg-gradient-to-r from-green-500 to-emerald-500 
                hover:from-green-600 hover:to-emerald-600 
                disabled:opacity-50 disabled:cursor-not-allowed
                text-white text-sm sm:text-base font-semibold 
                transition-all active:scale-95 shadow-lg shadow-green-500/25"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">{isDownloading ? 'Downloading...' : 'Download'}</span>
              <span className="sm:hidden">{isDownloading ? '...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
