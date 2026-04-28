import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react'
import { api } from '../api'

interface VideoPlayerProps {
  videoId: string
  currentTime: number
  onTimeUpdate: (time: number) => void
  clipStart: number
  clipEnd: number
}

export default function VideoPlayer({
  videoId,
  currentTime,
  onTimeUpdate,
  clipStart,
  clipEnd,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)

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

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [onTimeUpdate, clipStart, clipEnd])

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

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return
    
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={api.getVideoUrl(videoId)}
          className="w-full h-full"
          playsInline
        />
        
        {/* Clip region indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700">
          <div 
            className="absolute h-full bg-blue-500/50"
            style={{
              left: `${(clipStart / duration) * 100}%`,
              width: `${((clipEnd - clipStart) / duration) * 100}%`
            }}
          />
          <div 
            className="absolute h-full w-0.5 bg-red-500"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 p-3 bg-slate-900/80">
        <button
          onClick={togglePlay}
          className="p-2 hover:bg-slate-700 rounded-full transition"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white" />
          )}
        </button>

        <button
          onClick={toggleMute}
          className="p-2 hover:bg-slate-700 rounded-full transition"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>

        <div className="flex-1 text-sm text-slate-300">
          <span className="text-white font-mono">{formatTime(currentTime)}</span>
          <span className="text-slate-500"> / {formatTime(duration)}</span>
        </div>

        <div className="text-sm text-slate-400">
          Clip: {formatTime(clipStart)} - {formatTime(clipEnd)}
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-2 hover:bg-slate-700 rounded-full transition"
        >
          <Maximize className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  )
}
