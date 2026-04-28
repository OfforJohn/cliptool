from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import shutil

from app.services.video_processor import VideoProcessor
from app.services.ai_service import AIService

app = FastAPI(title="ClipTool API", version="1.0.0")

# CORS for React frontend
# In production, set CORS_ORIGINS env var to your Vercel frontend URL
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000")
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

# Mount static files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Services
video_processor = VideoProcessor()
ai_service = AIService()


class ClipRequest(BaseModel):
    video_id: str
    start_time: float
    end_time: float
    remove_audio: bool = False
    output_format: str = "mp4"


class TranscriptionRequest(BaseModel):
    video_id: str


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


@app.post("/api/upload", response_model=VideoInfo)
async def upload_video(file: UploadFile = File(...)):
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
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Create clip
    output_id = str(uuid.uuid4())
    output_path = os.path.join(OUTPUT_DIR, f"{output_id}.{request.output_format}")
    
    try:
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
    video_path = None
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{request.video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        transcription = ai_service.transcribe(video_path)
        return transcription
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/api/detect-scenes")
async def detect_scenes(video_id: str):
    """Detect scene changes in video for smart clipping"""
    video_path = None
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            video_path = path
            break
    
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")
    
    try:
        scenes = ai_service.detect_scenes(video_path)
        return {"scenes": scenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scene detection failed: {str(e)}")


@app.get("/api/video/{video_id}")
async def get_video(video_id: str):
    """Get video file for streaming"""
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            return FileResponse(path, media_type="video/mp4")
    raise HTTPException(status_code=404, detail="Video not found")


@app.delete("/api/video/{video_id}")
async def delete_video(video_id: str):
    """Delete an uploaded video"""
    for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        path = os.path.join(UPLOAD_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            os.remove(path)
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
