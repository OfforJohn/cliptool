from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import shutil
import httpx
import re
from urllib.parse import urlparse, unquote

from app.services.video_processor import VideoProcessor
from app.services.ai_service import AIService
from app.services.r2_storage import R2Storage
from app.services.caption_service import CaptionService

app = FastAPI(title="ClipTool API", version="1.0.0")

# CORS for React frontend
# In production, set CORS_ORIGINS env var to your Vercel frontend URL
cors_origins = os.getenv(
    "CORS_ORIGINS", 
    "http://localhost:5173,http://localhost:5174,http://localhost:3000,https://cliptool-7esz.vercel.app"
)
allowed_origins = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Mount static files under /api to match API routes
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/api/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Services
video_processor = VideoProcessor()
ai_service = AIService()
r2_storage = R2Storage()
caption_service = CaptionService()


class ClipRequest(BaseModel):
    video_id: str
    start_time: float
    end_time: float
    remove_audio: bool = False
    output_format: str = "mp4"
    video_format: Optional[str] = None  # Social media format preset


# Video format presets for social media
VIDEO_FORMAT_PRESETS = {
    'tiktok': {'width': 1080, 'height': 1920, 'aspect': '9:16'},
    'youtube-shorts': {'width': 1080, 'height': 1920, 'aspect': '9:16'},
    'instagram-reel': {'width': 1080, 'height': 1920, 'aspect': '9:16'},
    'instagram-feed': {'width': 1080, 'height': 1350, 'aspect': '4:5'},
    'instagram-square': {'width': 1080, 'height': 1080, 'aspect': '1:1'},
    'youtube': {'width': 1920, 'height': 1080, 'aspect': '16:9'},
    'twitter': {'width': 1280, 'height': 720, 'aspect': '16:9'},
}


class TranscriptionRequest(BaseModel):
    video_id: str


class URLDownloadRequest(BaseModel):
    url: str
    filename: Optional[str] = None


class CaptionRequest(BaseModel):
    video_id: str
    transcription: Optional[dict] = None  # Pass existing transcription, or we'll generate
    style: Optional[dict] = None  # Font, colors, position
    words_per_caption: int = 3  # Words shown at a time
    highlight_keywords: bool = True  # Enable keyword highlighting


class VideoInfo(BaseModel):
    id: str
    filename: str
    duration: float
    width: int
    height: int
    fps: float
    size_mb: float


@app.get("/")
async def root():
    return {"message": "ClipTool API is running"}


@app.get("/api/videos")
async def list_videos():
    """List all uploaded videos from R2 storage and local storage"""
    videos = []
    seen_ids = set()
    
    # Get videos from R2
    if r2_storage.enabled:
        r2_files = r2_storage.list_files("videos/")
        for f in r2_files:
            if f['video_id'] not in seen_ids:
                videos.append({
                    'id': f['video_id'],
                    'filename': f['filename'],
                    'size_mb': round(f['size'] / (1024 * 1024), 2),
                    'uploaded_at': f['last_modified'],
                    'source': 'cloud'
                })
                seen_ids.add(f['video_id'])
    
    # Also check local storage for videos not yet in R2
    for filename in os.listdir(UPLOAD_DIR):
        ext = os.path.splitext(filename)[1].lower()
        if ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            video_id = os.path.splitext(filename)[0]
            if video_id not in seen_ids:
                file_path = os.path.join(UPLOAD_DIR, filename)
                stat = os.stat(file_path)
                videos.append({
                    'id': video_id,
                    'filename': filename,
                    'size_mb': round(stat.st_size / (1024 * 1024), 2),
                    'uploaded_at': None,
                    'source': 'local'
                })
                seen_ids.add(video_id)
    
    return {'videos': videos}


@app.post("/api/upload/presigned")
async def get_presigned_upload_url(filename: str, content_type: str = "video/mp4"):
    """Get a presigned URL for direct upload to R2"""
    if not r2_storage.enabled:
        raise HTTPException(status_code=503, detail="Cloud storage not available. Use regular upload.")
    
    # Validate file extension
    allowed_extensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")
    
    # Generate unique video ID
    video_id = str(uuid.uuid4())
    r2_key = f"videos/{video_id}{ext}"
    
    # Get presigned upload URL
    upload_url = r2_storage.get_presigned_upload_url(r2_key, content_type, expires_in=3600)
    
    if not upload_url:
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")
    
    return {
        "video_id": video_id,
        "upload_url": upload_url,
        "r2_key": r2_key,
        "expires_in": 3600
    }


@app.post("/api/upload/confirm", response_model=VideoInfo)
async def confirm_upload(video_id: str, filename: str):
    """Confirm direct upload completed and get video info"""
    # Find the video in R2
    video_path = None
    video_ext = None
    r2_key = None
    
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        key = f"videos/{video_id}{ext}"
        if r2_storage.file_exists(key):
            r2_key = key
            video_ext = ext
            break
    
    if not r2_key:
        raise HTTPException(status_code=404, detail="Video not found in storage. Upload may have failed.")
    
    # Download to local for processing metadata
    local_path = os.path.join(UPLOAD_DIR, f"{video_id}{video_ext}")
    
    if not r2_storage.download_file(r2_key, local_path):
        raise HTTPException(status_code=500, detail="Failed to process video")
    
    try:
        info = video_processor.get_video_info(local_path)
        return VideoInfo(
            id=video_id,
            filename=filename,
            duration=info["duration"],
            width=info["width"],
            height=info["height"],
            fps=info["fps"],
            size_mb=info["size_mb"]
        )
    except Exception as e:
        # Clean up on failure
        if os.path.exists(local_path):
            os.remove(local_path)
        raise HTTPException(status_code=400, detail=f"Invalid video file: {str(e)}")


@app.post("/api/upload", response_model=VideoInfo)
async def upload_video(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    """Upload a video file for processing"""
    print(f"Upload received: filename={file.filename}, content_type={file.content_type}")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Validate file type
    allowed_extensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
    ext = os.path.splitext(file.filename)[1].lower()
    print(f"File extension: {ext}")
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")
    
    # Generate unique ID and save file
    video_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    print(f"File saved to: {file_path}, size: {os.path.getsize(file_path)} bytes")
    
    # Get video info
    try:
        info = video_processor.get_video_info(file_path)
        print(f"Video info: {info}")
        
        # Upload to R2 in background if enabled
        if r2_storage.enabled:
            r2_key = f"videos/{video_id}{ext}"
            content_type = file.content_type or "video/mp4"
            r2_storage.upload_file(file_path, r2_key, content_type)
            print(f"Uploaded to R2: {r2_key}")
        
        return VideoInfo(
            id=video_id,
            filename=file.filename,
            duration=info["duration"],
            width=info["width"],
            height=info["height"],
            fps=info["fps"],
            size_mb=info["size_mb"]
        )
    except Exception as e:
        print(f"Error processing video: {e}")
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Invalid video file: {str(e)}")


@app.post("/api/download-from-url", response_model=VideoInfo)
async def download_from_url(request: URLDownloadRequest):
    """Download a video from a direct URL (user's own content)"""
    print(f"URL download request: {request.url}")
    
    # Validate URL
    try:
        parsed = urlparse(request.url)
        if not parsed.scheme in ['http', 'https']:
            raise HTTPException(status_code=400, detail="Invalid URL scheme. Use http or https.")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")
    
    # Determine filename from URL or request
    if request.filename:
        filename = request.filename
    else:
        # Extract filename from URL path
        path = unquote(parsed.path)
        filename = os.path.basename(path) or "downloaded_video"
    
    # Ensure valid extension
    valid_extensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
    ext = os.path.splitext(filename)[1].lower()
    if ext not in valid_extensions:
        ext = '.mp4'
        filename = os.path.splitext(filename)[0] + ext
    
    # Generate unique ID
    video_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
    
    try:
        # Download the video with streaming
        async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
            async with client.stream('GET', request.url) as response:
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to download: HTTP {response.status_code}")
                
                # Check content type
                content_type = response.headers.get('content-type', '')
                if not any(t in content_type.lower() for t in ['video', 'audio', 'octet-stream', 'application']):
                    raise HTTPException(status_code=400, detail=f"URL does not point to a video or audio file (got {content_type})")
                
                # Stream to file
                with open(file_path, 'wb') as f:
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        f.write(chunk)
        
        print(f"Downloaded to: {file_path}, size: {os.path.getsize(file_path)} bytes")
        
        # Get video info
        info = video_processor.get_video_info(file_path)
        
        # Upload to R2 if enabled
        if r2_storage.enabled:
            r2_key = f"videos/{video_id}{ext}"
            r2_storage.upload_file(file_path, r2_key, "video/mp4")
            print(f"Uploaded to R2: {r2_key}")
        
        return VideoInfo(
            id=video_id,
            filename=filename,
            duration=info["duration"],
            width=info["width"],
            height=info["height"],
            fps=info["fps"],
            size_mb=info["size_mb"]
        )
    except httpx.TimeoutException:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=408, detail="Download timed out. Try a smaller file or faster URL.")
    except httpx.RequestError as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}")
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to process video: {str(e)}")


@app.post("/api/clip")
async def create_clip(request: ClipRequest):
    """Create a clip from a video"""
    # Find the video file
    video_path = None
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{request.video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            break
    
    # If not found locally, try to download from R2
    if not video_path and r2_storage.enabled:
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{request.video_id}{ext}"
            if r2_storage.file_exists(r2_key):
                local_path = os.path.join(UPLOAD_DIR, f"{request.video_id}{ext}")
                if r2_storage.download_file(r2_key, local_path):
                    video_path = local_path
                break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Create clip
    output_id = str(uuid.uuid4())
    output_path = os.path.join(OUTPUT_DIR, f"{output_id}.{request.output_format}")
    
    try:
        # Check if a social media format preset is requested
        if request.video_format and request.video_format in VIDEO_FORMAT_PRESETS:
            format_preset = VIDEO_FORMAT_PRESETS[request.video_format]
            video_processor.create_clip_with_format(
                input_path=video_path,
                output_path=output_path,
                start_time=request.start_time,
                end_time=request.end_time,
                target_width=format_preset['width'],
                target_height=format_preset['height'],
                remove_audio=request.remove_audio
            )
        else:
            # Original clip creation without format change
            video_processor.create_clip(
                input_path=video_path,
                output_path=output_path,
                start_time=request.start_time,
                end_time=request.end_time,
                remove_audio=request.remove_audio
            )
        return {
            "clip_id": output_id,
            "download_url": f"/outputs/{output_id}.{request.output_format}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create clip: {str(e)}")


@app.post("/api/remove-audio")
async def remove_audio(video_id: str):
    """Remove audio from a video"""
    video_path = None
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            break
    
    # If not found locally, try to download from R2
    if not video_path and r2_storage.enabled:
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{video_id}{ext}"
            if r2_storage.file_exists(r2_key):
                local_path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
                if r2_storage.download_file(r2_key, local_path):
                    video_path = local_path
                break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    output_id = str(uuid.uuid4())
    output_path = os.path.join(OUTPUT_DIR, f"{output_id}_noaudio.mp4")
    
    try:
        video_processor.remove_audio(video_path, output_path)
        return {
            "video_id": output_id,
            "download_url": f"/outputs/{output_id}_noaudio.mp4"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove audio: {str(e)}")


@app.post("/api/transcribe")
async def transcribe_video(request: TranscriptionRequest):
    """Transcribe video audio using Whisper AI"""
    print(f"Transcription request for video: {request.video_id}")
    video_path = None
    temp_downloaded = False
    
    # First check local storage
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{request.video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            break
    
    # If not found locally, try to download from R2
    if not video_path and r2_storage.enabled:
        print(f"Video not found locally, checking R2...")
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{request.video_id}{ext}"
            if r2_storage.file_exists(r2_key):
                local_path = os.path.join(UPLOAD_DIR, f"{request.video_id}{ext}")
                print(f"Downloading from R2: {r2_key}")
                if r2_storage.download_file(r2_key, local_path):
                    video_path = local_path
                    temp_downloaded = True
                    print(f"Downloaded to: {local_path}")
                break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        print(f"Starting transcription for: {video_path}")
        transcription = ai_service.transcribe(video_path)
        print(f"Transcription completed successfully")
        return transcription
    except Exception as e:
        print(f"Transcription failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/api/detect-scenes")
async def detect_scenes(video_id: str):
    """Detect scene changes in video for smart clipping"""
    video_path = None
    
    # First check local storage
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            break
    
    # If not found locally, try to download from R2
    if not video_path and r2_storage.enabled:
        print(f"Video not found locally for scene detection, checking R2...")
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{video_id}{ext}"
            if r2_storage.file_exists(r2_key):
                local_path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
                print(f"Downloading from R2: {r2_key}")
                if r2_storage.download_file(r2_key, local_path):
                    video_path = local_path
                    print(f"Downloaded to: {local_path}")
                break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        scenes = ai_service.detect_scenes(video_path)
        return {"scenes": scenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scene detection failed: {str(e)}")


@app.post("/api/add-captions")
async def add_captions(request: CaptionRequest):
    """Add auto-captions with keyword highlighting to video"""
    print(f"Caption request for video: {request.video_id}")
    video_path = None
    
    # First check local storage
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{request.video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            break
    
    # If not found locally, try to download from R2
    if not video_path and r2_storage.enabled:
        print(f"Video not found locally, checking R2...")
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{request.video_id}{ext}"
            if r2_storage.file_exists(r2_key):
                local_path = os.path.join(UPLOAD_DIR, f"{request.video_id}{ext}")
                print(f"Downloading from R2: {r2_key}")
                if r2_storage.download_file(r2_key, local_path):
                    video_path = local_path
                    print(f"Downloaded to: {local_path}")
                break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        # Get transcription if not provided
        transcription = request.transcription
        if not transcription:
            print("No transcription provided, generating...")
            transcription = ai_service.transcribe(video_path)
        
        # Generate output path
        output_id = str(uuid.uuid4())
        output_path = os.path.join(OUTPUT_DIR, f"{output_id}_captioned.mp4")
        
        # Burn captions into video
        print(f"Burning captions into video...")
        success = caption_service.burn_captions(
            video_path=video_path,
            output_path=output_path,
            transcription=transcription,
            style=request.style,
            words_per_caption=request.words_per_caption,
            use_highlight=request.highlight_keywords,
        )
        
        if not success:
            raise Exception("Failed to burn captions into video")
        
        print(f"Captions added successfully: {output_path}")
        return {
            "video_id": output_id,
            "download_url": f"/outputs/{output_id}_captioned.mp4"
        }
        
    except Exception as e:
        print(f"Caption generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Caption generation failed: {str(e)}")


@app.get("/api/video/{video_id}/info")
async def get_video_info(video_id: str):
    """Get video metadata by ID"""
    video_path = None
    video_ext = None
    
    # First check local storage
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            video_ext = ext
            break
    
    # If not found locally, try to download from R2
    if not video_path and r2_storage.enabled:
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{video_id}{ext}"
            if r2_storage.file_exists(r2_key):
                # Download to local for processing
                local_path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
                if r2_storage.download_file(r2_key, local_path):
                    video_path = local_path
                    video_ext = ext
                    print(f"Downloaded from R2: {r2_key}")
                break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        info = video_processor.get_video_info(video_path)
        return VideoInfo(
            id=video_id,
            filename=f"video{video_ext}",
            duration=info["duration"],
            width=info["width"],
            height=info["height"],
            fps=info["fps"],
            size_mb=info["size_mb"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get video info: {str(e)}")


@app.get("/api/video/{video_id}")
async def get_video(video_id: str):
    """Get video file for streaming"""
    # First check local storage
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            return FileResponse(path, media_type="video/mp4")
    
    # If not found locally, try R2 presigned URL (redirect)
    if r2_storage.enabled:
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{video_id}{ext}"
            if r2_storage.file_exists(r2_key):
                presigned_url = r2_storage.get_presigned_url(r2_key, expires_in=3600)
                if presigned_url:
                    return RedirectResponse(url=presigned_url)
    raise HTTPException(status_code=404, detail="Video not found")


@app.delete("/api/video/{video_id}")
async def delete_video(video_id: str):
    """Delete an uploaded video"""
    deleted = False
    
    # Delete from local storage
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            os.remove(path)
            deleted = True
            
            # Also delete from R2 if enabled
            if r2_storage.enabled:
                r2_key = f"videos/{video_id}{ext}"
                r2_storage.delete_file(r2_key)
            break
    
    # If not deleted locally, try R2 only
    if not deleted and r2_storage.enabled:
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{video_id}{ext}"
            if r2_storage.delete_file(r2_key):
                deleted = True
                break
    
    if deleted:
        return {"message": "Video deleted"}
    raise HTTPException(status_code=404, detail="Video not found")


@app.post("/api/compress")
async def compress_video(video_id: str):
    """Compress a video for faster processing"""
    video_path = None
    video_ext = None
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            video_ext = ext
            break
    
    # If not found locally, try to download from R2
    if not video_path and r2_storage.enabled:
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            r2_key = f"videos/{video_id}{ext}"
            if r2_storage.file_exists(r2_key):
                local_path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
                if r2_storage.download_file(r2_key, local_path):
                    video_path = local_path
                    video_ext = ext
                break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        # Compress to a new file
        compressed_id = str(uuid.uuid4())
        compressed_path = os.path.join(UPLOAD_DIR, f"{compressed_id}.mp4")
        
        result = video_processor.compress_video(video_path, compressed_path)
        
        # Return info about compression
        return {
            "original_video_id": video_id,
            "compressed_video_id": compressed_id,
            "original_size_mb": result["original_size_mb"],
            "compressed_size_mb": result["compressed_size_mb"],
            "reduction_percent": result["reduction_percent"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compression failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
