import { useState } from 'react'
import { Upload, Scissors, VolumeX, Sparkles } from 'lucide-react'
import VideoUpload from './components/VideoUpload'
import VideoPlayer from './components/VideoPlayer'
import Timeline from './components/Timeline'
import ClipControls from './components/ClipControls'
import TranscriptionPanel from './components/TranscriptionPanel'
import { VideoInfo, Transcription, Scene } from './types'
import { api } from './api'

function App() {
  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [removeAudio, setRemoveAudio] = useState(false)
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')

  const handleVideoUploaded = (info: VideoInfo) => {
    setVideo(info)
    setClipStart(0)
    setClipEnd(info.duration)
    setTranscription(null)
    setScenes([])
  }

  const handleTranscribe = async () => {
    if (!video) return
    setIsProcessing(true)
    setProcessingStatus('Transcribing with AI...')
    try {
      const result = await api.transcribe(video.id)
      setTranscription(result)
    } catch (error) {
      console.error('Transcription failed:', error)
      alert('Transcription failed. Make sure Whisper is installed.')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const handleDetectScenes = async () => {
    if (!video) return
    setIsProcessing(true)
    setProcessingStatus('Detecting scenes...')
    try {
      const result = await api.detectScenes(video.id)
      setScenes(result.scenes)
    } catch (error) {
      console.error('Scene detection failed:', error)
      alert('Scene detection failed.')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const handleCreateClip = async () => {
    if (!video) return
    setIsProcessing(true)
    setProcessingStatus('Creating clip...')
    try {
      const result = await api.createClip({
        video_id: video.id,
        start_time: clipStart,
        end_time: clipEnd,
        remove_audio: removeAudio,
        output_format: 'mp4'
      })
      
      // Download the clip
      const link = document.createElement('a')
      link.href = result.download_url
      link.download = `clip_${Date.now()}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Clip creation failed:', error)
      alert('Failed to create clip.')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const handleRemoveAudioFromFull = async () => {
    if (!video) return
    setIsProcessing(true)
    setProcessingStatus('Removing audio...')
    try {
      const result = await api.removeAudio(video.id)
      
      const link = document.createElement('a')
      link.href = result.download_url
      link.download = `${video.filename}_noaudio.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Remove audio failed:', error)
      alert('Failed to remove audio.')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scissors className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-white">ClipTool</h1>
            <span className="text-sm text-slate-400">AI-Powered Video Clipping</span>
          </div>
          {video && (
            <div className="text-sm text-slate-400">
              {video.filename} • {video.duration.toFixed(1)}s • {video.width}x{video.height}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!video ? (
          <VideoUpload onUploaded={handleVideoUploaded} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Video Area */}
            <div className="lg:col-span-2 space-y-4">
              <VideoPlayer
                videoId={video.id}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                clipStart={clipStart}
                clipEnd={clipEnd}
              />

              <Timeline
                duration={video.duration}
                currentTime={currentTime}
                clipStart={clipStart}
                clipEnd={clipEnd}
                scenes={scenes}
                transcription={transcription}
                onClipStartChange={setClipStart}
                onClipEndChange={setClipEnd}
                onSeek={setCurrentTime}
              />

              <ClipControls
                clipStart={clipStart}
                clipEnd={clipEnd}
                duration={video.duration}
                removeAudio={removeAudio}
                onClipStartChange={setClipStart}
                onClipEndChange={setClipEnd}
                onRemoveAudioChange={setRemoveAudio}
                onCreateClip={handleCreateClip}
                isProcessing={isProcessing}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* AI Tools */}
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  AI Tools
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={handleTranscribe}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Transcribe Audio
                  </button>
                  <button
                    onClick={handleDetectScenes}
                    disabled={isProcessing}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Scissors className="w-4 h-4" />
                    Detect Scenes
                  </button>
                  <button
                    onClick={handleRemoveAudioFromFull}
                    disabled={isProcessing}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <VolumeX className="w-4 h-4" />
                    Remove Audio (Full Video)
                  </button>
                </div>
                {isProcessing && (
                  <div className="mt-4 text-center text-sm text-slate-400">
                    <div className="animate-pulse">{processingStatus}</div>
                  </div>
                )}
              </div>

              {/* Scenes */}
              {scenes.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Detected Scenes ({scenes.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {scenes.map((scene) => (
                      <button
                        key={scene.scene_number}
                        onClick={() => {
                          setClipStart(scene.start)
                          setClipEnd(scene.end)
                        }}
                        className="w-full text-left bg-slate-700 hover:bg-slate-600 p-2 rounded text-sm transition"
                      >
                        <div className="text-white">Scene {scene.scene_number}</div>
                        <div className="text-slate-400 text-xs">
                          {scene.start.toFixed(1)}s - {scene.end.toFixed(1)}s ({scene.duration.toFixed(1)}s)
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcription */}
              {transcription && (
                <TranscriptionPanel
                  transcription={transcription}
                  onSegmentClick={(start, end) => {
                    setClipStart(start)
                    setClipEnd(end)
                  }}
                  currentTime={currentTime}
                />
              )}

              {/* New Video Button */}
              <button
                onClick={() => setVideo(null)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload New Video
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
