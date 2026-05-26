import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Scissors, VolumeX, Sparkles, Plus, Link, Check, Upload, Type } from 'lucide-react'
import VideoPlayer from './components/VideoPlayer'
import Timeline from './components/Timeline'
import ClipControls from './components/ClipControls'
import TranscriptionPanel from './components/TranscriptionPanel'
import VideoLibrary from './components/VideoLibrary'
import HeroSection from './components/HeroSection'
import UploadSection from './components/UploadSection'
import FormatSelector from './components/FormatSelector'
import VideoPreviewModal from './components/VideoPreviewModal'
import { useToast } from './components/Toast'
import { VideoInfo, Transcription, Scene } from './types'
import { api } from './api'

interface PreviewState {
  isOpen: boolean
  videoUrl: string
  filename: string
  title: string
}

function App() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [removeAudio, setRemoveAudio] = useState(false)
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)
  const [copied, setCopied] = useState(false)
  const [videoFormat, setVideoFormat] = useState('original')
  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    videoUrl: '',
    filename: '',
    title: ''
  })
  const uploadRef = useRef<HTMLDivElement>(null)

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load video from URL param on mount
  useEffect(() => {
    const videoId = searchParams.get('v')
    if (videoId && !video) {
      loadVideoFromId(videoId)
    }
  }, [searchParams])

  const loadVideoFromId = async (videoId: string) => {
    setIsLoadingVideo(true)
    try {
      const info = await api.getVideoInfo(videoId)
      setVideo(info)
      setClipStart(0)
      setClipEnd(info.duration)
    } catch (error) {
      console.error('Failed to load video:', error)
      // Clear invalid video ID from URL
      setSearchParams({})
    } finally {
      setIsLoadingVideo(false)
    }
  }

  const handleVideoUploaded = (info: VideoInfo) => {
    setVideo(info)
    setClipStart(0)
    setClipEnd(info.duration)
    setTranscription(null)
    setScenes([])
    setVideoFormat('original')
    // Update URL with video ID
    setSearchParams({ v: info.id })
  }

  const handleNewVideo = () => {
    setVideo(null)
    setClipStart(0)
    setClipEnd(0)
    setTranscription(null)
    setScenes([])
    setVideoFormat('original')
    // Clear URL param
    setSearchParams({})
  }

  const copyShareLink = () => {
    if (!video) return
    const url = `${window.location.origin}?v=${video.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTranscribe = async () => {
    if (!video) return
    setIsProcessing(true)
    setProcessingStatus('Transcribing with AI (this may take a few minutes)...')
    console.log(`Starting transcription for video: ${video.id} (${video.filename})`)
    try {
      const result = await api.transcribe(video.id)
      console.log(`Transcription complete - Model: ${result.model || 'unknown'}, Language: ${result.language}`)
      setTranscription(result)
    } catch (error: unknown) {
      console.error('Transcription failed:', error)
      let errorMessage = 'Transcription failed. '
      if (error instanceof Error && error.message.includes('timeout')) {
        errorMessage += 'The operation timed out. Try with a shorter video or check server logs.'
      } else if (error instanceof Error && 'response' in error) {
        const axiosError = error as { response?: { data?: { detail?: string } } }
        errorMessage += axiosError.response?.data?.detail || 'Server error occurred.'
      } else {
        errorMessage += 'An unexpected error occurred.'
      }
      showToast(errorMessage, 'error')
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
      showToast('Scene detection failed.', 'error')
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
        output_format: 'mp4',
        video_format: videoFormat !== 'original' ? videoFormat : undefined
      })
      
      // Show preview instead of auto-download
      const formatSuffix = videoFormat !== 'original' ? `_${videoFormat}` : ''
      setPreview({
        isOpen: true,
        videoUrl: result.download_url,
        filename: `clip${formatSuffix}_${Date.now()}.mp4`,
        title: 'Clip Preview'
      })
      showToast('Clip created! Preview your video.', 'success')
    } catch (error) {
      console.error('Clip creation failed:', error)
      showToast('Failed to create clip.', 'error')
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
      
      // Download using blob (works cross-origin)
      setProcessingStatus('Downloading...')
      await api.downloadFile(result.download_url, `${video.filename}_noaudio.mp4`)
    } catch (error) {
      console.error('Remove audio failed:', error)
      showToast('Failed to remove audio.', 'error')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const handleAddCaptions = async () => {
    if (!video) return
    setIsProcessing(true)
    
    try {
      // First transcribe if we don't have transcription
      let trans = transcription
      if (!trans) {
        setProcessingStatus('Transcribing audio (this may take a few minutes)...')
        trans = await api.transcribe(video.id)
        setTranscription(trans)
      }
      
      setProcessingStatus('Adding captions to video...')
      const result = await api.addCaptions({
        video_id: video.id,
        transcription: trans,
        words_per_caption: 3,
        highlight_keywords: true,
        style: {
          font_size: 28,
          primary_color: 'FFFFFF',
          highlight_color: 'FFFF00',
          position: 'bottom'
        }
      })
      
      // Show preview instead of auto-download
      setPreview({
        isOpen: true,
        videoUrl: result.download_url,
        filename: `${video.filename}_captioned.mp4`,
        title: 'Captioned Video Preview'
      })
      showToast('Captions added! Preview your video.', 'success')
    } catch (error: unknown) {
      console.error('Caption generation failed:', error)
      let errorMessage = 'Failed to add captions. '
      if (error instanceof Error && 'response' in error) {
        const axiosError = error as { response?: { data?: { detail?: string } } }
        errorMessage += axiosError.response?.data?.detail || ''
      }
      showToast(errorMessage, 'error')
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
          <button 
            onClick={handleNewVideo}
            className="flex items-center gap-3 hover:opacity-80 transition"
          >
            <Scissors className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-white">ClipTool</h1>
            <span className="text-sm text-slate-400 hidden sm:inline">AI-Powered Video Clipping</span>
          </button>
          <div className="flex items-center gap-2">
            {video && (
              <>
                <div className="text-sm text-slate-400 hidden md:block">
                  {video.filename} • {video.duration.toFixed(1)}s
                </div>
                <button
                  onClick={copyShareLink}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm transition"
                  title="Copy shareable link"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Share'}
                </button>
                <button
                  onClick={handleNewVideo}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  New Video
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isLoadingVideo ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-white text-lg">Loading video...</p>
          </div>
        ) : !video ? (
          <div className="space-y-0">
            <HeroSection onScrollToUpload={scrollToUpload} />
            <UploadSection onUploaded={handleVideoUploaded} uploadRef={uploadRef} />
            <div className="max-w-4xl mx-auto px-4 pb-12">
              <VideoLibrary onSelectVideo={loadVideoFromId} />
            </div>
          </div>
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
                videoFormat={videoFormat}
                videoWidth={video.width}
                videoHeight={video.height}
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

              <FormatSelector
                selectedFormat={videoFormat}
                onFormatChange={setVideoFormat}
                clipDuration={clipEnd - clipStart}
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
                  <button
                    onClick={handleAddCaptions}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:bg-slate-600 text-white py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <Type className="w-4 h-4" />
                    Auto-Captions + Keywords
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

      {/* Video Preview Modal */}
      <VideoPreviewModal
        isOpen={preview.isOpen}
        videoUrl={preview.videoUrl}
        filename={preview.filename}
        title={preview.title}
        onClose={() => setPreview({ ...preview, isOpen: false })}
      />
    </div>
  )
}

export default App
