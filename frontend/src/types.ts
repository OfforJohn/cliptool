export interface VideoInfo {
  id: string
  filename: string
  duration: number
  width: number
  height: number
  fps: number
  size_mb: number
}

export interface ClipRequest {
  video_id: string
  start_time: number
  end_time: number
  remove_audio: boolean
  output_format: string
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
