import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null

export async function loadFFmpeg(onProgress?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg
  }

  ffmpeg = new FFmpeg()

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message)
  })

  onProgress?.('Loading video compressor...')

  // Load ffmpeg core from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  return ffmpeg
}

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  videoBitrate?: string
  audioBitrate?: string
}

export async function compressVideo(
  file: File,
  onProgress?: (percent: number, stage: string) => void,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1280,
    maxHeight = 720,
    videoBitrate = '1M',
    audioBitrate = '128k'
  } = options

  onProgress?.(0, 'Loading compressor...')
  const ff = await loadFFmpeg()

  const inputName = 'input' + getExtension(file.name)
  const outputName = 'output.mp4'

  onProgress?.(10, 'Reading file...')
  await ff.writeFile(inputName, await fetchFile(file))

  onProgress?.(20, 'Compressing video...')
  
  // Set up progress tracking
  ff.on('progress', ({ progress }) => {
    const percent = 20 + Math.round(progress * 70)
    onProgress?.(percent, 'Compressing video...')
  })

  // Compress with reasonable quality/size balance
  await ff.exec([
    '-i', inputName,
    '-vf', `scale='min(${maxWidth},iw)':min'(${maxHeight},ih)':force_original_aspect_ratio=decrease`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '28',
    '-b:v', videoBitrate,
    '-c:a', 'aac',
    '-b:a', audioBitrate,
    '-movflags', '+faststart',
    outputName
  ])

  onProgress?.(95, 'Finalizing...')
  const data = await ff.readFile(outputName)
  
  // Clean up
  await ff.deleteFile(inputName)
  await ff.deleteFile(outputName)

  // Convert to Uint8Array and create blob
  const uint8Array = new Uint8Array(data as Uint8Array)
  const compressedBlob = new Blob([uint8Array], { type: 'video/mp4' })
  const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.mp4'), {
    type: 'video/mp4'
  })

  onProgress?.(100, 'Done!')
  
  console.log(`Compressed: ${formatSize(file.size)} → ${formatSize(compressedFile.size)} (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`)
  
  return compressedFile
}

function getExtension(filename: string): string {
  const match = filename.match(/\.[^/.]+$/)
  return match ? match[0] : '.mp4'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function shouldCompress(file: File, maxSizeMB: number = 50): boolean {
  return file.size > maxSizeMB * 1024 * 1024
}
