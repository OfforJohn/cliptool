export interface VideoInfo {
  id: string
  filename: string
  duration: number
  width: number
  height: number
  fps: number
  size_mb: number
}

export interface VideoFormat {
  id: string
  name: string
  platform: string
  aspectRatio: string
  width: number
  height: number
  maxDuration?: number  // in seconds
  icon: string
}

export interface ClipRequest {
  video_id: string
  start_time: number
  end_time: number
  remove_audio: boolean
  output_format: string
  video_format?: string  // Social media format preset
}

export interface TranscriptionSegment {
  id: number
  start: number
  end: number
  text: string
  words: {
    word: string
    start: number
    end: number
  }[]
}

export interface Transcription {
  text: string
  language: string
  segments: TranscriptionSegment[]
}

export interface Scene {
  scene_number: number
  start: number
  end: number
  duration: number
}

export interface ClipResult {
  clip_id: string
  download_url: string
}

export interface CompressionResult {
  original_video_id: string
  compressed_video_id: string
  original_size_mb: number
  compressed_size_mb: number
  reduction_percent: number
}
