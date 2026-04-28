import { Transcription } from '../types'

interface TranscriptionPanelProps {
  transcription: Transcription
  onSegmentClick: (start: number, end: number) => void
  currentTime: number
}

export default function TranscriptionPanel({
  transcription,
  onSegmentClick,
  currentTime,
}: TranscriptionPanelProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">Transcription</h3>
        <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
          {transcription.language.toUpperCase()}
        </span>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {transcription.segments.map((segment) => {
          const isActive = currentTime >= segment.start && currentTime < segment.end
          
          return (
            <button
              key={segment.id}
              onClick={() => onSegmentClick(segment.start, segment.end)}
              className={`w-full text-left p-2 rounded transition ${
                isActive 
                  ? 'bg-blue-600/30 border border-blue-500' 
                  : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-400 font-mono whitespace-nowrap pt-0.5">
                  {formatTime(segment.start)}
                </span>
                <p className={`text-sm ${isActive ? 'text-white' : 'text-slate-300'}`}>
                  {segment.text}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Full transcript toggle */}
      <details className="mt-4">
        <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
          View full transcript
        </summary>
        <p className="mt-2 text-sm text-slate-300 bg-slate-900 p-3 rounded max-h-32 overflow-y-auto">
          {transcription.text}
        </p>
      </details>
    </div>
  )
}
