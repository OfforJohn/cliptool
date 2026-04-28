# ClipTool - AI-Powered Video Clipping Tool

A web-based video clipping tool with AI transcription and scene detection.

## Features

- **Video Upload**: Drag & drop or browse for video files
- **Timeline Editor**: Visual timeline with clip selection handles
- **AI Transcription**: Automatic speech-to-text using OpenAI Whisper
- **Scene Detection**: Automatic scene boundary detection
- **Audio Removal**: Remove audio from clips or full videos
- **Export Clips**: Download trimmed video segments

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Python + FastAPI + FFmpeg
- **AI**: OpenAI Whisper, PySceneDetect

## Prerequisites

- Python 3.10+
- Node.js 18+
- FFmpeg installed and in PATH

### Installing FFmpeg

**Windows:**
```bash
winget install FFmpeg
# or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

## Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## Usage

1. Start the backend server (port 8000)
2. Start the frontend dev server (port 5173)
3. Open http://localhost:5173
4. Upload a video file
5. Use the timeline to select clip region
6. Use AI tools for transcription or scene detection
7. Export your clip

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload a video file |
| `/api/clip` | POST | Create a clip from video |
| `/api/remove-audio` | POST | Remove audio from video |
| `/api/transcribe` | POST | Transcribe video audio |
| `/api/detect-scenes` | POST | Detect scene changes |
| `/api/video/{id}` | GET | Stream video file |
| `/api/video/{id}` | DELETE | Delete video |

## Project Structure

```
clipping tool/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   └── services/
│   │       ├── video_processor.py  # FFmpeg wrapper
│   │       └── ai_service.py       # Whisper + scene detection
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── App.tsx              # Main app component
    │   ├── api.ts               # API client
    │   ├── types.ts             # TypeScript types
    │   └── components/
    │       ├── VideoUpload.tsx
    │       ├── VideoPlayer.tsx
    │       ├── Timeline.tsx
    │       ├── ClipControls.tsx
    │       └── TranscriptionPanel.tsx
    └── package.json
```

## License

MIT
