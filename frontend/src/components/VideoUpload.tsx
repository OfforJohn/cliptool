import { useState, useCallback } from 'react'
import { Upload, Film, AlertCircle, Zap } from 'lucide-react'
import { api } from '../api'
import { VideoInfo } from '../types'
import { compressVideo, shouldCompress } from '../utils/videoCompressor'

interface VideoUploadProps {
  onUploaded: (info: VideoInfo) => void
}

export default function VideoUpload({ onUploaded }: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm']
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      setError('Please upload a valid video file (MP4, MOV, AVI, MKV, or WebM)')
      return
    }

    setError(null)
    setIsUploading(true)
    setUploadProgress(0)
    setCompressionProgress(0)

    try {
      let fileToUpload = file
      
      // Compress if file is larger than 50MB
      if (shouldCompress(file, 50)) {
        setIsCompressing(true)
        setStatusMessage('Compressing video for faster upload...')
        
        const originalSize = (file.size / (1024 * 1024)).toFixed(1)
        
        fileToUpload = await compressVideo(file, (percent, stage) => {
          setCompressionProgress(percent)
          setStatusMessage(stage)
        })
        
        const newSize = (fileToUpload.size / (1024 * 1024)).toFixed(1)
        setStatusMessage(`Compressed: ${originalSize}MB → ${newSize}MB`)
        setIsCompressing(false)
      }
      
      setStatusMessage('Uploading...')
      const info = await api.uploadVideo(fileToUpload, (percent) => {
        setUploadProgress(percent)
      })
      
      setTimeout(() => {
        onUploaded(info)
      }, 300)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Upload failed. Please try again.')
      setIsUploading(false)
      setIsCompressing(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-8">
        <Film className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-white mb-2">Upload Your Video</h2>
        <p className="text-slate-400">
          Drag and drop a video file, or click to browse
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
          }
          ${isUploading ? 'pointer-events-none' : 'cursor-pointer'}
        `}
      >
        <input
          type="file"
          accept="video/*"
          onChange={handleInputChange}
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        {isUploading ? (
          <div className="space-y-4">
            {isCompressing ? (
              <>
                <Zap className="w-16 h-16 text-yellow-500 mx-auto animate-pulse" />
                <div className="text-white font-medium">{statusMessage}</div>
                <div className="w-full bg-slate-700 rounded-full h-2 max-w-xs mx-auto">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${compressionProgress}%` }}
                  />
                </div>
                <div className="text-slate-400 text-sm">{compressionProgress}%</div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-white font-medium">{statusMessage || 'Uploading...'}</div>
                <div className="w-full bg-slate-700 rounded-full h-2 max-w-xs mx-auto">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="text-slate-400 text-sm">{uploadProgress}%</div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className={`w-12 h-12 mx-auto ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
            <div>
              <span className="text-white font-medium">Drop your video here</span>
              <span className="text-slate-400"> or </span>
              <span className="text-blue-500 font-medium">browse</span>
            </div>
            <p className="text-slate-500 text-sm">
              Supports MP4, MOV, AVI, MKV, WebM
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      <div className="mt-8 text-center text-slate-500 text-sm">
        <p>Large files (50MB+) are automatically compressed for faster upload</p>
      </div>
    </div>
  )
}
