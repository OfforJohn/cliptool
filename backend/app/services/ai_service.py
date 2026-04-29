import os
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
                # Default: 'small' on Render (good balance of speed/accuracy), 'base' locally
                is_render = os.getenv("RENDER", "").lower() == "true"
                default_model = "small" if is_render else "base"
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
            # Transcribe the video (faster-whisper handles audio extraction)
            segments_generator, info = self.whisper_model.transcribe(
                video_path,
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
            
            return {
                'text': ' '.join(full_text),
                'language': info.language or 'en',
                'segments': segments,
                'model': self._model_size or 'unknown'
            }
        except Exception as e:
            raise Exception(f"Transcription error: {str(e)}")
    
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
