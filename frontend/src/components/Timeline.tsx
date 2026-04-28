import { useRef, useState, useCallback } from 'react'
import { Transcription, Scene } from '../types'

interface TimelineProps {
  duration: number
  currentTime: number
  clipStart: number
  clipEnd: number
  scenes: Scene[]
  transcription: Transcription | null
  onClipStartChange: (time: number) => void
  onClipEndChange: (time: number) => void
  onSeek: (time: number) => void
}

export default function Timeline({
  duration,
  currentTime,
  clipStart,
  clipEnd,
  scenes,
  transcription,
  onClipStartChange,
  onClipEndChange,
  onSeek,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'seek' | null>(null)

  const getTimeFromX = useCallback((clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    
    const rect = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    return (x / rect.width) * duration
  }, [duration])

  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'seek') => {
    e.preventDefault()
    setIsDragging(type)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const time = getTimeFromX(moveEvent.clientX)
      
      if (type === 'start') {
        onClipStartChange(Math.min(time, clipEnd - 0.1))
      } else if (type === 'end') {
        onClipEndChange(Math.max(time, clipStart + 0.1))
      } else {
        onSeek(time)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleTrackClick = (e: React.MouseEvent) => {
    if (isDragging) return
    const time = getTimeFromX(e.clientX)
    onSeek(time)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="text-sm text-slate-400 mb-2 flex justify-between">
        <span>Timeline</span>
        <span>Duration: {formatTime(duration)}</span>
      </div>

      {/* Main timeline track */}
      <div 
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-16 bg-slate-900 rounded-lg cursor-pointer overflow-hidden"
      >
        {/* Scene markers */}
        {scenes.map((scene, i) => (
          <div
            key={i}
            className="absolute top-0 h-full border-l-2 border-purple-500/50"
            style={{ left: `${(scene.start / duration) * 100}%` }}
          >
            <div className="absolute top-0 left-1 text-xs text-purple-400 whitespace-nowrap">
              Scene {scene.scene_number}
            </div>
          </div>
        ))}

        {/* Transcription waveform visualization (simplified) */}
        {transcription && (
          <div className="absolute inset-0 flex items-center">
            {transcription.segments.map((segment, i) => (
              <div
                key={i}
                className="absolute h-4 bg-green-500/30 rounded"
                style={{
                  left: `${(segment.start / duration) * 100}%`,
                  width: `${((segment.end - segment.start) / duration) * 100}%`,
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              />
            ))}
          </div>
        )}

        {/* Clip region */}
        <div 
          className="absolute top-0 bottom-0 bg-blue-500/20 border-y-2 border-blue-500"
          style={{
            left: `${(clipStart / duration) * 100}%`,
            width: `${((clipEnd - clipStart) / duration) * 100}%`
          }}
        />

        {/* Clip start handle */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'start')}
          className="absolute top-0 bottom-0 w-3 bg-blue-600 cursor-ew-resize hover:bg-blue-500 transition flex items-center justify-center z-10"
          style={{ left: `${(clipStart / duration) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-0.5 h-8 bg-white/50 rounded" />
        </div>

        {/* Clip end handle */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'end')}
          className="absolute top-0 bottom-0 w-3 bg-blue-600 cursor-ew-resize hover:bg-blue-500 transition flex items-center justify-center z-10"
          style={{ left: `${(clipEnd / duration) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-0.5 h-8 bg-white/50 rounded" />
        </div>

        {/* Playhead */}
        <div
          onMouseDown={(e) => handleMouseDown(e, 'seek')}
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 cursor-ew-resize z-20"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full" />
        </div>
      </div>

      {/* Time markers */}
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        <span>0:00</span>
        <span>{formatTime(duration / 4)}</span>
        <span>{formatTime(duration / 2)}</span>
        <span>{formatTime((duration * 3) / 4)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
