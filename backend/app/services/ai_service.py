import os
import subprocess
import tempfile
from typing import Dict, List, Any


class AIService:
    """AI-powered video analysis service"""
    
    def __init__(self):
        self._whisper_model = None
        self._model_loaded = False
        self._model_size = None
    
    @property
    def whisper_model(self):
        """Lazy load Whisper model using faster-whisper"""
        if self._whisper_model is None:
            try:
                from faster_whisper import WhisperModel
                # Use WHISPER_MODEL env var
                # Default: 'tiny' on Render (only model that fits free tier), 'base' locally
                is_render = os.getenv("RENDER", "").lower() == "true"
                default_model = "tiny" if is_render else "base"
                self._model_size = os.getenv("WHISPER_MODEL", default_model)
                print(f"Loading Whisper model: {self._model_size} (Render: {is_render})")
                self._whisper_model = WhisperModel(self._model_size, device="cpu", compute_type="int8")
                self._model_loaded = True
                print(f"Whisper model '{self._model_size}' loaded successfully")
            except Exception as e:
                print(f"Failed to load Whisper model: {e}")
                raise Exception(f"Failed to load Whisper AI model: {str(e)}. Check server logs.")
        return self._whisper_model
    
    def transcribe(self, video_path: str) -> Dict[str, Any]:
        """
        Transcribe video audio using faster-whisper.
        Returns full transcript with word-level timestamps.
        """
        try:
            # First, check if video has audio and extract it
            audio_path = self._extract_audio(video_path)
            if not audio_path:
                raise Exception("Video has no audio track or audio extraction failed")
            
            try:
                # Transcribe the extracted audio
                segments_generator, info = self.whisper_model.transcribe(
                    audio_path,
                    word_timestamps=True
                )
                
                # Format segments for frontend
                segments = []
                full_text = []
                
                for i, segment in enumerate(segments_generator):
                    words = []
                    if segment.words:
                        words = [
                            {
                                'word': w.word,
                                'start': w.start,
                                'end': w.end
                            }
                            for w in segment.words
                        ]
                    
                    segments.append({
                        'id': i,
                        'start': segment.start,
                        'end': segment.end,
                        'text': segment.text.strip(),
                        'words': words
                    })
                    full_text.append(segment.text.strip())
                
                # Safely get language
                language = 'en'
                try:
                    if hasattr(info, 'language') and info.language:
                        language = info.language
                except:
                    pass
                
                return {
                    'text': ' '.join(full_text),
                    'language': language,
                    'segments': segments,
                    'model': self._model_size or 'unknown'
                }
            finally:
                # Clean up temp audio file
                if audio_path and audio_path != video_path and os.path.exists(audio_path):
                    os.remove(audio_path)
                    
        except Exception as e:
            raise Exception(f"Transcription error: {str(e)}")
    
    def _extract_audio(self, video_path: str) -> str:
        """Extract audio from video to a temporary WAV file for reliable transcription"""
        try:
            # Check if video has audio stream
            probe_cmd = [
                'ffprobe', '-v', 'error', '-select_streams', 'a',
                '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', video_path
            ]
            result = subprocess.run(probe_cmd, capture_output=True, text=True)
            if 'audio' not in result.stdout:
                print(f"No audio stream found in {video_path}")
                return None
            
            # Extract audio to temp WAV file (more reliable for whisper)
            temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_audio.close()
            
            extract_cmd = [
                'ffmpeg', '-y', '-i', video_path,
                '-vn',  # No video
                '-acodec', 'pcm_s16le',  # WAV format
                '-ar', '16000',  # 16kHz sample rate (optimal for whisper)
                '-ac', '1',  # Mono
                temp_audio.name
            ]
            
            result = subprocess.run(extract_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"FFmpeg audio extraction failed: {result.stderr}")
                if os.path.exists(temp_audio.name):
                    os.remove(temp_audio.name)
                return None
            
            # Verify the extracted audio file exists and has content
            if os.path.exists(temp_audio.name) and os.path.getsize(temp_audio.name) > 1000:
                print(f"Audio extracted successfully to {temp_audio.name}")
                return temp_audio.name
            else:
                print(f"Extracted audio file is empty or too small")
                if os.path.exists(temp_audio.name):
                    os.remove(temp_audio.name)
                return None
                
        except Exception as e:
            print(f"Audio extraction error: {str(e)}")
            return None
    
    def detect_scenes(self, video_path: str, threshold: float = 27.0) -> List[Dict[str, float]]:
        """
        Detect scene changes in video using PySceneDetect.
        Returns list of scenes with start/end timestamps.
        """
        try:
            from scenedetect import open_video, SceneManager
            from scenedetect.detectors import ContentDetector
            
            # Open video
            video = open_video(video_path)
            scene_manager = SceneManager()
            
            # Add content detector (detects scene changes based on content)
            scene_manager.add_detector(ContentDetector(threshold=threshold))
            
            # Detect scenes
            scene_manager.detect_scenes(video)
            scene_list = scene_manager.get_scene_list()
            
            # Format for frontend
            scenes = []
            for i, (start, end) in enumerate(scene_list):
                scenes.append({
                    'scene_number': i + 1,
                    'start': start.get_seconds(),
                    'end': end.get_seconds(),
                    'duration': (end - start).get_seconds()
                })
            
            return scenes
        except Exception as e:
            raise Exception(f"Scene detection error: {str(e)}")
    
    def suggest_clips(self, transcription: Dict, video_duration: float) -> List[Dict]:
        """
        Suggest clip points based on transcription.
        Looks for natural breaks, sentences, and topic changes.
        """
        segments = transcription.get('segments', [])
        if not segments:
            return []
        
        suggestions = []
        
        # Suggest clips at natural sentence endings (longer pauses)
        for i, segment in enumerate(segments):
            # Look for segments that end with punctuation and have a pause after
            text = segment['text']
            if any(text.strip().endswith(p) for p in ['.', '!', '?']):
                if i < len(segments) - 1:
                    next_segment = segments[i + 1]
                    gap = next_segment['start'] - segment['end']
                    
                    # If there's a significant pause (> 0.5s), suggest as clip point
                    if gap > 0.5:
                        suggestions.append({
                            'type': 'natural_break',
                            'timestamp': segment['end'],
                            'confidence': min(gap / 2.0, 1.0),  # Higher gap = higher confidence
                            'reason': 'Natural pause in speech'
                        })
        
        # Suggest clips at regular intervals for long videos
        if video_duration > 60:
            interval = 30  # Every 30 seconds
            current = interval
            while current < video_duration:
                # Find nearest segment boundary
                nearest = min(segments, key=lambda s: abs(s['end'] - current))
                suggestions.append({
                    'type': 'interval',
                    'timestamp': nearest['end'],
                    'confidence': 0.5,
                    'reason': f'Regular interval (~{int(current)}s)'
                })
                current += interval
        
        # Sort by timestamp and remove duplicates
        suggestions.sort(key=lambda x: x['timestamp'])
        
        # Remove suggestions too close to each other
        filtered = []
        last_ts = -10
        for s in suggestions:
            if s['timestamp'] - last_ts > 5:
                filtered.append(s)
                last_ts = s['timestamp']
        
        return filtered
