import { useState, useEffect } from 'react'
import { Film, Cloud, HardDrive, Trash2, Play, RefreshCw } from 'lucide-react'
import { api } from '../api'

interface VideoItem {
  id: string
  filename: string
  size_mb: number
  uploaded_at: string | null
  source: string
}

interface VideoLibraryProps {
  onSelectVideo: (videoId: string) => void
}

export default function VideoLibrary({ onSelectVideo }: VideoLibraryProps) {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVideos = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.listVideos()
      setVideos(result.videos)
    } catch (err) {
      console.error('Failed to fetch videos:', err)
      setError('Failed to load video library')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  const handleDelete = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this video permanently?')) return
    
    try {
      await api.deleteVideo(videoId)
      setVideos(videos.filter(v => v.id !== videoId))
    } catch (err) {
      console.error('Failed to delete video:', err)
      alert('Failed to delete video')
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Local only'
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-slate-400">Loading videos...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <p className="text-red-400 text-center">{error}</p>
        <button
          onClick={fetchVideos}
          className="mt-4 mx-auto flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="text-center py-8">
          <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No videos uploaded yet</p>
          <p className="text-slate-500 text-sm mt-1">Upload a video to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-blue-500" />
          Your Videos ({videos.length})
        </h3>
        <button
          onClick={fetchVideos}
          className="p-2 hover:bg-slate-700 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      
      <div className="grid gap-3 max-h-80 overflow-y-auto">
        {videos.map((video) => (
          <div
            key={video.id}
            onClick={() => onSelectVideo(video.id)}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">
                    {video.filename}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{video.size_mb} MB</span>
                    <span>•</span>
                    {video.source === 'cloud' ? (
                      <span className="flex items-center gap-1">
                        <Cloud className="w-3 h-3" />
                        Cloud
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        Local
                      </span>
                    )}
                    <span>•</span>
                    <span>{formatDate(video.uploaded_at)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(video.id, e)}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-all"
                title="Delete video"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
