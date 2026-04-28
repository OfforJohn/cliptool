import axios from 'axios'
import { VideoInfo, ClipRequest, Transcription, Scene, ClipResult, CompressionResult } from './types'

// Use environment variable for API URL in production, fallback to /api for local dev (proxied by Vite)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 min for large uploads/processing
})

export const api = {
  async uploadVideo(file: File, onProgress?: (percent: number) => void): Promise<VideoInfo> {
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

  async createClip(request: ClipRequest): Promise<ClipResult> {
    const response = await client.post<ClipResult>('/clip', request)
    return response.data
  },

  async removeAudio(videoId: string): Promise<ClipResult> {
    const response = await client.post<ClipResult>(`/remove-audio?video_id=${videoId}`)
    return response.data
  },

  async transcribe(videoId: string): Promise<Transcription> {
    const response = await client.post<Transcription>('/transcribe', { video_id: videoId })
    return response.data
  },

  async detectScenes(videoId: string): Promise<{ scenes: Scene[] }> {
    const response = await client.post<{ scenes: Scene[] }>(`/detect-scenes?video_id=${videoId}`)
    return response.data
  },

  async deleteVideo(videoId: string): Promise<void> {
    await client.delete(`/video/${videoId}`)
  },

  async compressVideo(videoId: string): Promise<CompressionResult> {
    const response = await client.post<CompressionResult>(`/compress?video_id=${videoId}`)
    return response.data
  },

  async getVideoInfo(videoId: string): Promise<VideoInfo> {
    const response = await client.get<VideoInfo>(`/video/${videoId}/info`)
    return response.data
  },

  getVideoUrl(videoId: string): string {
    return `${API_BASE_URL}/video/${videoId}`
  },
}
