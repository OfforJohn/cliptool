import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react'
import { api } from '../api'

interface VideoPlayerProps {
  videoId: string
  currentTime: number
  onTimeUpdate: (time: number) => void
  clipStart: number
  clipEnd: number
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export default function VideoPlayer({
  videoId,
  currentTime,
  onTimeUpdate,
  clipStart,
  clipEnd,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [hoverTime, setHoverTime] = useState(0)
  const [hoverPosition, setHoverPosition] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      onTimeUpdate(video.currentTime)
      
      // Loop within clip bounds when playing
      if (video.currentTime >= clipEnd) {
        video.currentTime = clipStart
      }
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1))
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('progress', handleProgress)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('progress', handleProgress)
    }
  }, [onTimeUpdate, clipStart, clipEnd])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return
      
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
        case 'j':
          e.preventDefault()
          seekRelative(-5)
          break
        case 'ArrowRight':
        case 'l':
          e.preventDefault()
          seekRelative(5)
          break
        case 'ArrowUp':
          e.preventDefault()
          changeVolume(0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          changeVolume(-0.1)
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault()
          const percent = parseInt(e.key) / 10
          video.currentTime = duration * percent
          break
        case '<':
          e.preventDefault()
          decreaseSpeed()
          break
        case '>':
          e.preventDefault()
          increaseSpeed()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [duration, volume, playbackSpeed])

  // Sync external time changes (e.g., from timeline scrubbing)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    if (Math.abs(video.currentTime - currentTime) > 0.5) {
      video.currentTime = currentTime
    }
  }, [currentTime])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      // Start from clip start if outside bounds
      if (video.currentTime < clipStart || video.currentTime >= clipEnd) {
        video.currentTime = clipStart
      }
      video.play()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const changeVolume = (delta: number) => {
    const video = videoRef.current
    if (!video) return
    const newVolume = Math.max(0, Math.min(1, volume + delta))
    video.volume = newVolume
    setVolume(newVolume)
    if (newVolume > 0 && isMuted) {
      video.muted = false
      setIsMuted(false)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const newVolume = parseFloat(e.target.value)
    video.volume = newVolume
    setVolume(newVolume)
    if (newVolume > 0 && isMuted) {
      video.muted = false
      setIsMuted(false)
    }
  }

  const seekRelative = (seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds))
  }

  const seekTo = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(duration, time))
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const progress = progressRef.current
    if (!progress) return
    
    const rect = progress.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    seekTo(percent * duration)
  }

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const progress = progressRef.current
    if (!progress) return
    
    const rect = progress.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    setHoverTime(percent * duration)
    setHoverPosition(e.clientX - rect.left)
  }

  const changePlaybackSpeed = (speed: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
    setPlaybackSpeed(speed)
    setShowSpeedMenu(false)
  }

  const increaseSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
    if (currentIndex < PLAYBACK_SPEEDS.length - 1) {
      changePlaybackSpeed(PLAYBACK_SPEEDS[currentIndex + 1])
    }
  }

  const decreaseSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
    if (currentIndex > 0) {
      changePlaybackSpeed(PLAYBACK_SPEEDS[currentIndex - 1])
    }
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return
    
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div 
      ref={containerRef}
      className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700"
    >
      <div className="relative aspect-video bg-black group">
        <video
          ref={videoRef}
          src={api.getVideoUrl(videoId)}
          className="w-full h-full cursor-pointer"
          playsInline
          onClick={togglePlay}
        />
        
        {/* Click to play/pause overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        >
          {!isPlaying && (
            <div className="bg-black/50 rounded-full p-4">
              <Play className="w-12 h-12 text-white" />
            </div>
          )}
        </div>

        {/* Progress bar overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Seekable progress bar */}
          <div 
            ref={progressRef}
            className="relative h-1 bg-slate-600 rounded cursor-pointer group/progress hover:h-2 transition-all"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            {/* Buffered */}
            <div 
              className="absolute h-full bg-slate-500 rounded"
              style={{ width: `${(buffered / duration) * 100}%` }}
            />
            {/* Clip region */}
            <div 
              className="absolute h-full bg-blue-500/30"
              style={{
                left: `${(clipStart / duration) * 100}%`,
                width: `${((clipEnd - clipStart) / duration) * 100}%`
              }}
            />
            {/* Progress */}
            <div 
              className="absolute h-full bg-red-500 rounded"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            {/* Playhead */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `calc(${(currentTime / duration) * 100}% - 6px)` }}
            />
            {/* Hover preview */}
            {isHovering && (
              <div 
                className="absolute -top-8 bg-black/90 px-2 py-1 rounded text-xs text-white transform -translate-x-1/2"
                style={{ left: hoverPosition }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 p-2 bg-slate-900/80">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="p-2 hover:bg-slate-700 rounded-full transition"
          title={isPlaying ? 'Pause (k)' : 'Play (k)'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white" />
          )}
        </button>

        {/* Skip back 5s */}
        <button
          onClick={() => seekRelative(-5)}
          className="p-2 hover:bg-slate-700 rounded-full transition"
          title="Back 5s (j)"
        >
          <SkipBack className="w-4 h-4 text-white" />
        </button>

        {/* Skip forward 5s */}
        <button
          onClick={() => seekRelative(5)}
          className="p-2 hover:bg-slate-700 rounded-full transition"
          title="Forward 5s (l)"
        >
          <SkipForward className="w-4 h-4 text-white" />
        </button>

        {/* Volume */}
        <div className="flex items-center gap-1 group/volume">
          <button
            onClick={toggleMute}
            className="p-2 hover:bg-slate-700 rounded-full transition"
            title="Mute (m)"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-0 group-hover/volume:w-20 transition-all duration-200 h-1 bg-slate-600 rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>

        {/* Time */}
        <div className="flex-1 text-sm text-slate-300 ml-2">
          <span className="text-white font-mono">{formatTime(currentTime)}</span>
          <span className="text-slate-500"> / {formatTime(duration)}</span>
        </div>

        {/* Clip info */}
        <div className="text-xs text-slate-400 hidden sm:block">
          Clip: {formatTime(clipStart)} - {formatTime(clipEnd)}
        </div>

        {/* Playback speed */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="px-2 py-1 hover:bg-slate-700 rounded transition text-sm text-white"
            title="Playback speed"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-600 rounded-lg shadow-lg py-1 min-w-[80px]">
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  onClick={() => changePlaybackSpeed(speed)}
                  className={`w-full px-3 py-1 text-sm text-left hover:bg-slate-700 ${
                    speed === playbackSpeed ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-2 hover:bg-slate-700 rounded-full transition"
          title="Fullscreen (f)"
        >
          <Maximize className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  )
}
