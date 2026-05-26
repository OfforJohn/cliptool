import axios from 'axios'
import { VideoInfo, ClipRequest, Transcription, Scene, ClipResult, CompressionResult, CaptionRequest, CaptionResult } from './types'

// Use environment variable for API URL in production, fallback to /api for local dev (proxied by Vite)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 min for large uploads/processing
})

// Longer timeout client for AI operations (transcription, scene detection)
const aiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 900000, // 15 min for AI transcription (model loading + processing)
})

interface PresignedUploadResponse {
  video_id: string
  upload_url: string
  r2_key: string
  expires_in: number
}

export const api = {
  // Get presigned URL for direct upload to R2
  async getPresignedUploadUrl(filename: string, contentType: string): Promise<PresignedUploadResponse | null> {
    try {
      const response = await client.post<PresignedUploadResponse>(
        `/upload/presigned?filename=${encodeURIComponent(filename)}&content_type=${encodeURIComponent(contentType)}`
      )
      return response.data
    } catch {
      // R2 not available, fall back to regular upload
      return null
    }
  },

  // Confirm direct upload completed
  async confirmUpload(videoId: string, filename: string): Promise<VideoInfo> {
    const response = await client.post<VideoInfo>(
      `/upload/confirm?video_id=${encodeURIComponent(videoId)}&filename=${encodeURIComponent(filename)}`
    )
    return response.data
  },

  // Upload directly to R2 using presigned URL
  async uploadToR2(uploadUrl: string, file: File, onProgress?: (percent: number) => void): Promise<boolean> {
    try {
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type || 'video/mp4',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(percent)
          }
        },
      })
      return true
    } catch (error) {
      console.error('Direct upload failed:', error)
      return false
    }
  },

  // Smart upload: tries direct R2 upload first, falls back to server upload
  async uploadVideo(file: File, onProgress?: (percent: number) => void): Promise<VideoInfo> {
    // Try direct upload to R2 first
    const presigned = await this.getPresignedUploadUrl(file.name, file.type || 'video/mp4')
    
    if (presigned) {
      // Direct upload to R2 (faster!)
      const success = await this.uploadToR2(presigned.upload_url, file, (percent) => {
        // Scale progress: 0-90% for upload, 90-100% for confirmation
        onProgress?.(Math.round(percent * 0.9))
      })
      
      if (success) {
        onProgress?.(95)
        // Confirm upload and get video info
        const info = await this.confirmUpload(presigned.video_id, file.name)
        onProgress?.(100)
        return info
      }
      // Fall through to regular upload if direct failed
    }
    
    // Fallback: Regular upload through server
    const formData = new FormData()
    formData.append('file', file)
    const response = await client.post<VideoInfo>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
    })
    return response.data
  },

  // Download video from a direct URL
  async downloadFromUrl(url: string, filename?: string): Promise<VideoInfo> {
    const response = await aiClient.post<VideoInfo>('/download-from-url', { url, filename })
    return response.data
  },

  async createClip(request: ClipRequest): Promise<ClipResult> {
    const response = await client.post<ClipResult>('/clip', request)
    return response.data
  },

  async removeAudio(videoId: string): Promise<ClipResult> {
    const response = await client.post<ClipResult>(`/remove-audio?video_id=${videoId}`)
    return response.data
  },

  async transcribe(videoId: string): Promise<Transcription> {
    // Use longer timeout client for AI operations
    const response = await aiClient.post<Transcription>('/transcribe', { video_id: videoId })
    return response.data
  },

  async detectScenes(videoId: string): Promise<{ scenes: Scene[] }> {
    // Use longer timeout client for AI operations
    const response = await aiClient.post<{ scenes: Scene[] }>(`/detect-scenes?video_id=${videoId}`)
    return response.data
  },

  async deleteVideo(videoId: string): Promise<void> {
    await client.delete(`/video/${videoId}`)
  },

  async compressVideo(videoId: string): Promise<CompressionResult> {
    const response = await client.post<CompressionResult>(`/compress?video_id=${videoId}`)
    return response.data
  },

  async addCaptions(
    request: CaptionRequest, 
    onProgress?: (progress: number, message: string) => void
  ): Promise<CaptionResult> {
    // Start the job
    const startResponse = await client.post<{ job_id: string }>('/add-captions', request)
    const jobId = startResponse.data.job_id
    
    // Poll for progress
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
      
      const statusResponse = await client.get<{
        status: string
        progress: number
        message: string
        result: CaptionResult | null
      }>(`/job/${jobId}`)
      
      const { status, progress, message, result } = statusResponse.data
      
      if (onProgress) {
        onProgress(progress, message)
      }
      
      if (status === 'complete' && result) {
        return result
      }
      
      if (status === 'error') {
        throw new Error(message || 'Caption generation failed')
      }
    }
  },

  async getVideoInfo(videoId: string): Promise<VideoInfo> {
    const response = await client.get<VideoInfo>(`/video/${videoId}/info`)
    return response.data
  },

  async listVideos(): Promise<{ videos: Array<{ id: string; filename: string; size_mb: number; uploaded_at: string | null; source: string }> }> {
    const response = await client.get('/videos')
    return response.data
  },

  getVideoUrl(videoId: string): string {
    return `${API_BASE_URL}/video/${videoId}`
  },

  // Get full download URL for outputs
  getDownloadUrl(relativePath: string): string {
    // relativePath is like "/outputs/uuid.mp4"
    // Need to prepend API base URL
    if (relativePath.startsWith('http')) {
      return relativePath
    }
    return `${API_BASE_URL}${relativePath}`
  },

  // Download file as blob and trigger browser download (works cross-origin)
  async downloadFile(relativePath: string, filename: string): Promise<void> {
    const url = this.getDownloadUrl(relativePath)
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }
      
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up object URL
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      console.error('Download failed:', error)
      // Fallback: open in new tab
      window.open(url, '_blank')
    }
  },
}
