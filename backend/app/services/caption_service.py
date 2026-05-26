"""
Caption Service - Generate captions with keyword highlighting for videos
"""
import os
import re
import tempfile
import subprocess
from typing import List, Dict, Any, Optional

# Common filler words to NOT highlight
FILLER_WORDS = {
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him',
    'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its',
    'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'get', 'got', 'getting', 'go', 'going', 'gone', 'went',
    'like', 'know', 'think', 'say', 'said', 'says', 'saying',
    'um', 'uh', 'ah', 'oh', 'okay', 'ok', 'yeah', 'yes', 'no',
    'well', 'now', 'actually', 'basically', 'literally', 'really',
}

# Words that should always be highlighted (action/impact words)
HIGHLIGHT_WORDS = {
    'amazing', 'awesome', 'incredible', 'fantastic', 'perfect', 'best',
    'worst', 'terrible', 'horrible', 'beautiful', 'stunning', 'brilliant',
    'genius', 'crazy', 'insane', 'wild', 'epic', 'legendary', 'ultimate',
    'secret', 'hidden', 'revealed', 'discover', 'learn', 'master',
    'free', 'new', 'first', 'last', 'only', 'exclusive', 'limited',
    'important', 'critical', 'essential', 'key', 'main', 'major',
    'money', 'rich', 'wealth', 'success', 'win', 'winning', 'winner',
    'love', 'hate', 'fear', 'hope', 'dream', 'goal', 'power', 'strong',
    'never', 'always', 'forever', 'everything', 'nothing', 'everyone',
    'stop', 'start', 'begin', 'end', 'finish', 'complete', 'done',
    'watch', 'look', 'see', 'listen', 'hear', 'try', 'test', 'prove',
    'change', 'transform', 'revolutionize', 'breakthrough', 'game-changer',
}


class CaptionService:
    """Generate captions with keyword highlighting"""
    
    def __init__(self):
        self.default_style = {
            'font': 'Arial',
            'font_size': 24,
            'primary_color': 'FFFFFF',  # White
            'highlight_color': 'FFFF00',  # Yellow
            'outline_color': '000000',  # Black
            'outline_width': 2,
            'position': 'bottom',  # bottom, center, top
            'margin_v': 40,
        }
    
    def is_keyword(self, word: str) -> bool:
        """Determine if a word should be highlighted"""
        clean_word = re.sub(r'[^\w]', '', word.lower())
        
        # Always highlight if in highlight list
        if clean_word in HIGHLIGHT_WORDS:
            return True
        
        # Don't highlight filler words
        if clean_word in FILLER_WORDS:
            return False
        
        # Highlight numbers and words with numbers
        if any(c.isdigit() for c in clean_word):
            return True
        
        # Highlight longer words (likely important nouns/verbs)
        if len(clean_word) >= 6:
            return True
        
        # Highlight capitalized words (names, places)
        if word and word[0].isupper() and len(clean_word) > 2:
            return True
        
        return False
    
    def generate_ass_subtitles(
        self,
        transcription: Dict[str, Any],
        style: Optional[Dict[str, Any]] = None,
        words_per_caption: int = 3,
    ) -> str:
        """
        Generate ASS subtitle file content with highlighted keywords.
        ASS format allows styling individual words differently.
        """
        style = {**self.default_style, **(style or {})}
        
        # ASS header with styles
        ass_content = f"""[Script Info]
Title: Auto Captions
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{style['font']},{style['font_size']},&H00{style['primary_color']},&H000000FF,&H00{style['outline_color']},&H80000000,1,0,0,0,100,100,0,0,1,{style['outline_width']},1,2,10,10,{style['margin_v']},1
Style: Highlight,{style['font']},{int(style['font_size'] * 1.2)},&H00{style['highlight_color']},&H000000FF,&H00{style['outline_color']},&H80000000,1,0,0,0,100,100,0,0,1,{style['outline_width']},2,2,10,10,{style['margin_v']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        
        segments = transcription.get('segments', [])
        
        for segment in segments:
            words = segment.get('words', [])
            if not words:
                # Fallback to segment text if no word timestamps
                start = self._format_ass_time(segment['start'])
                end = self._format_ass_time(segment['end'])
                text = self._style_text(segment['text'], style)
                ass_content += f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n"
                continue
            
            # Group words into captions
            i = 0
            while i < len(words):
                caption_words = words[i:i + words_per_caption]
                if not caption_words:
                    break
                
                start = self._format_ass_time(caption_words[0]['start'])
                end = self._format_ass_time(caption_words[-1]['end'])
                
                # Build styled text
                styled_parts = []
                for w in caption_words:
                    word_text = w['word'].strip()
                    if self.is_keyword(word_text):
                        # Highlighted word - larger and colored
                        styled_parts.append(f"{{\\rHighlight}}{word_text.upper()}{{\\rDefault}}")
                    else:
                        styled_parts.append(word_text)
                
                text = ' '.join(styled_parts)
                ass_content += f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n"
                
                i += words_per_caption
        
        return ass_content
    
    def generate_srt_subtitles(
        self,
        transcription: Dict[str, Any],
        words_per_caption: int = 5,
    ) -> str:
        """Generate simple SRT subtitles (no highlighting, just text)"""
        segments = transcription.get('segments', [])
        srt_content = ""
        caption_num = 1
        
        for segment in segments:
            words = segment.get('words', [])
            if not words:
                # Use segment directly
                start = self._format_srt_time(segment['start'])
                end = self._format_srt_time(segment['end'])
                srt_content += f"{caption_num}\n{start} --> {end}\n{segment['text'].strip()}\n\n"
                caption_num += 1
                continue
            
            # Group words
            i = 0
            while i < len(words):
                caption_words = words[i:i + words_per_caption]
                if not caption_words:
                    break
                
                start = self._format_srt_time(caption_words[0]['start'])
                end = self._format_srt_time(caption_words[-1]['end'])
                text = ' '.join(w['word'].strip() for w in caption_words)
                
                srt_content += f"{caption_num}\n{start} --> {end}\n{text}\n\n"
                caption_num += 1
                i += words_per_caption
        
        return srt_content
    
    def burn_captions(
        self,
        video_path: str,
        output_path: str,
        transcription: Dict[str, Any],
        style: Optional[Dict[str, Any]] = None,
        words_per_caption: int = 3,
        use_highlight: bool = True,
    ) -> bool:
        """Burn captions into video using FFmpeg"""
        try:
            # Create temp subtitle file
            if use_highlight:
                sub_content = self.generate_ass_subtitles(transcription, style, words_per_caption)
                sub_ext = '.ass'
            else:
                sub_content = self.generate_srt_subtitles(transcription, words_per_caption)
                sub_ext = '.srt'
            
            with tempfile.NamedTemporaryFile(mode='w', suffix=sub_ext, delete=False, encoding='utf-8') as f:
                f.write(sub_content)
                sub_path = f.name
            
            try:
                # Build FFmpeg command
                # Escape the subtitle path for FFmpeg filter (Windows paths need special handling)
                escaped_sub_path = sub_path.replace('\\', '/').replace(':', '\\:')
                
                if use_highlight:
                    # ASS subtitles
                    filter_str = f"ass='{escaped_sub_path}'"
                else:
                    # SRT subtitles with styling
                    filter_str = f"subtitles='{escaped_sub_path}':force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2'"
                
                cmd = [
                    'ffmpeg', '-y',
                    '-i', video_path,
                    '-vf', filter_str,
                    '-c:a', 'copy',
                    output_path
                ]
                
                print(f"Running FFmpeg caption burn: {' '.join(cmd)}")
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                    print(f"FFmpeg error: {result.stderr}")
                    return False
                
                return os.path.exists(output_path)
                
            finally:
                # Clean up temp subtitle file
                if os.path.exists(sub_path):
                    os.remove(sub_path)
                    
        except Exception as e:
            print(f"Caption burn error: {str(e)}")
            return False
    
    def _format_ass_time(self, seconds: float) -> str:
        """Format time for ASS subtitles (H:MM:SS.cc)"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int((seconds % 1) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
    
    def _format_srt_time(self, seconds: float) -> str:
        """Format time for SRT subtitles (HH:MM:SS,mmm)"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
    
    def _style_text(self, text: str, style: Dict) -> str:
        """Apply highlighting to keywords in plain text"""
        words = text.split()
        styled = []
        for word in words:
            if self.is_keyword(word):
                styled.append(f"{{\\rHighlight}}{word.upper()}{{\\rDefault}}")
            else:
                styled.append(word)
        return ' '.join(styled)
