import { useState, useCallback } from 'react'
import { Upload, Film, AlertCircle, Zap } from 'lucide-react'
import { api } from '../api'
import { VideoInfo } from '../types'

interface UploadSectionProps {
  onUploaded: (info: VideoInfo) => void
  uploadRef?: React.RefObject<HTMLDivElement | null>
}

// Threshold for suggesting server-side compression (50MB)
const COMPRESS_THRESHOLD_MB = 50

export default function UploadSection({ onUploaded, uploadRef }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
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

    try {
      const fileSizeMB = file.size / (1024 * 1024)
      setStatusMessage(`Uploading ${fileSizeMB.toFixed(1)}MB to cloud...`)
      
      const info = await api.uploadVideo(file, (percent) => {
        setUploadProgress(percent)
        if (percent < 90) {
          setStatusMessage(`Uploading ${fileSizeMB.toFixed(1)}MB to cloud... ${percent}%`)
        } else if (percent < 100) {
          setStatusMessage('Processing video...')
        }
      })
      
      if (fileSizeMB > COMPRESS_THRESHOLD_MB) {
        setIsCompressing(true)
        setStatusMessage('Optimizing video on server...')
        
        try {
          const compressionResult = await api.compressVideo(info.id)
          const compressedInfo: VideoInfo = {
            ...info,
            id: compressionResult.compressed_video_id,
            size_mb: compressionResult.compressed_size_mb
          }
          
          setStatusMessage(`Optimized: ${compressionResult.original_size_mb.toFixed(1)}MB → ${compressionResult.compressed_size_mb.toFixed(1)}MB`)
          
          setTimeout(() => {
            onUploaded(compressedInfo)
          }, 500)
        } catch (compressErr) {
          console.warn('Server compression failed, using original:', compressErr)
          onUploaded(info)
        }
      } else {
        setTimeout(() => {
          onUploaded(info)
        }, 300)
      }
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
    if (file) handleFile(file)
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
    if (file) handleFile(file)
  }

  return (
    <div ref={uploadRef} className="max-w-4xl mx-auto px-4 py-12" id="upload-section">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Upload Your Video
        </h2>
        <p className="text-slate-400">
          Drag and drop or click to select • Supports MP4, MOV, AVI, MKV, WebM
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-all
          ${isDragging 
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
            : 'border-slate-600 hover:border-blue-500/50 bg-slate-800/30'
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
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center">
                  <Zap className="w-10 h-10 text-white animate-pulse" />
                </div>
                <div className="text-white font-medium text-lg">{statusMessage}</div>
                <div className="text-slate-400 text-sm">Optimizing for best performance...</div>
              </>
            ) : (
              <>
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 animate-pulse" />
                  <div className="absolute inset-1 rounded-xl bg-slate-900 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{uploadProgress}%</span>
                  </div>
                </div>
                <div className="text-white font-medium text-lg">{statusMessage || 'Uploading...'}</div>
                <div className="w-full max-w-sm mx-auto bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-10 h-10 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-medium text-lg mb-1">
                Drop your video here
              </p>
              <p className="text-slate-500 text-sm">
                or click to browse from your device
              </p>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                Up to 4K
              </span>
              <span>•</span>
              <span>Max 2GB</span>
              <span>•</span>
              <span>Fast processing</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
