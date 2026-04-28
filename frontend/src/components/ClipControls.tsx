import { Download, VolumeX, Volume2 } from 'lucide-react'

interface ClipControlsProps {
  clipStart: number
  clipEnd: number
  duration: number
  removeAudio: boolean
  onClipStartChange: (time: number) => void
  onClipEndChange: (time: number) => void
  onRemoveAudioChange: (value: boolean) => void
  onCreateClip: () => void
  isProcessing: boolean
}

export default function ClipControls({
  clipStart,
  clipEnd,
  duration,
  removeAudio,
  onClipStartChange,
  onClipEndChange,
  onRemoveAudioChange,
  onCreateClip,
  isProcessing,
}: ClipControlsProps) {
  const clipDuration = clipEnd - clipStart

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':')
    if (parts.length === 2) {
      const [mins, secsAndMs] = parts
      const [secs, ms = '0'] = secsAndMs.split('.')
      return parseInt(mins) * 60 + parseInt(secs) + parseInt(ms) / 100
    }
    return 0
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Start Time */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Start Time</label>
          <input
            type="text"
            value={formatTime(clipStart)}
            onChange={(e) => {
              const time = parseTime(e.target.value)
              if (!isNaN(time) && time >= 0 && time < clipEnd) {
                onClipStartChange(time)
              }
            }}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* End Time */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">End Time</label>
          <input
            type="text"
            value={formatTime(clipEnd)}
            onChange={(e) => {
              const time = parseTime(e.target.value)
              if (!isNaN(time) && time > clipStart && time <= duration) {
                onClipEndChange(time)
              }
            }}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Clip Duration */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Clip Duration</label>
          <div className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono text-sm">
            {formatTime(clipDuration)}
          </div>
        </div>

        {/* Remove Audio Toggle */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Audio</label>
          <button
            onClick={() => onRemoveAudioChange(!removeAudio)}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded transition ${
              removeAudio 
                ? 'bg-orange-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {removeAudio ? (
              <>
                <VolumeX className="w-4 h-4" />
                Audio Removed
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                Keep Audio
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={() => {
            onClipStartChange(0)
            onClipEndChange(duration)
          }}
          className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"
        >
          Select All
        </button>
        <button
          onClick={() => {
            const mid = duration / 2
            onClipStartChange(Math.max(0, mid - 5))
            onClipEndChange(Math.min(duration, mid + 5))
          }}
          className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"
        >
          Select Middle 10s
        </button>
        <button
          onClick={() => {
            onClipStartChange(0)
            onClipEndChange(Math.min(duration, 30))
          }}
          className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"
        >
          First 30s
        </button>
        <button
          onClick={() => {
            onClipStartChange(Math.max(0, duration - 30))
            onClipEndChange(duration)
          }}
          className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"
        >
          Last 30s
        </button>
      </div>

      {/* Export Button */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <button
          onClick={onCreateClip}
          disabled={isProcessing || clipDuration <= 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Export Clip ({formatTime(clipDuration)})
            </>
          )}
        </button>
      </div>
    </div>
  )
}
