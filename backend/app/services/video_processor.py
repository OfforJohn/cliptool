import ffmpeg
import subprocess
import json
import os
from typing import Dict, Any

# Set FFmpeg path explicitly for Windows
FFMPEG_DIR = os.path.expandvars(r"%LOCALAPPDATA%\ffmpeg")
if os.path.exists(FFMPEG_DIR):
    # Find the ffmpeg bin directory
    for item in os.listdir(FFMPEG_DIR):
        bin_path = os.path.join(FFMPEG_DIR, item, "bin")
        if os.path.exists(bin_path):
            os.environ["PATH"] = bin_path + os.pathsep + os.environ.get("PATH", "")
            break


class VideoProcessor:
    """Video processing service using FFmpeg"""
    
    def get_video_info(self, video_path: str) -> Dict[str, Any]:
        """Get video metadata using ffprobe"""
        try:
            probe = ffmpeg.probe(video_path)
            video_stream = next(
                (s for s in probe['streams'] if s['codec_type'] == 'video'),
                None
            )
            
            if not video_stream:
                raise ValueError("No video stream found")
            
            # Parse duration
            duration = float(probe['format'].get('duration', 0))
            
            # Parse dimensions
            width = int(video_stream.get('width', 0))
            height = int(video_stream.get('height', 0))
            
            # Parse FPS
            fps_str = video_stream.get('r_frame_rate', '30/1')
            if '/' in fps_str:
                num, den = fps_str.split('/')
                fps = float(num) / float(den) if float(den) != 0 else 30.0
            else:
                fps = float(fps_str)
            
            # File size in MB
            size_bytes = int(probe['format'].get('size', 0))
            size_mb = size_bytes / (1024 * 1024)
            
            return {
                'duration': duration,
                'width': width,
                'height': height,
                'fps': round(fps, 2),
                'size_mb': round(size_mb, 2)
            }
        except ffmpeg.Error as e:
            raise Exception(f"FFprobe error: {e.stderr.decode() if e.stderr else str(e)}")
    
    def create_clip(
        self,
        input_path: str,
        output_path: str,
        start_time: float,
        end_time: float,
        remove_audio: bool = False
    ) -> str:
        """Create a clip from video between start and end times"""
        duration = end_time - start_time
        
        try:
            stream = ffmpeg.input(input_path, ss=start_time, t=duration)
            
            if remove_audio:
                stream = stream.output(output_path, an=None, c='copy')
            else:
                stream = stream.output(output_path, c='copy')
            
            # Run with overwrite
            stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
            
            return output_path
        except ffmpeg.Error as e:
            # If stream copy fails, try re-encoding
            try:
                stream = ffmpeg.input(input_path, ss=start_time, t=duration)
                
                if remove_audio:
                    stream = stream.output(
                        output_path, 
                        an=None,
                        vcodec='libx264',
                        preset='fast',
                        crf=23
                    )
                else:
                    stream = stream.output(
                        output_path,
                        vcodec='libx264',
                        acodec='aac',
                        preset='fast',
                        crf=23
                    )
                
                stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
                return output_path
            except ffmpeg.Error as e2:
                raise Exception(f"FFmpeg error: {e2.stderr.decode() if e2.stderr else str(e2)}")
    
    def remove_audio(self, input_path: str, output_path: str) -> str:
        """Remove audio track from video"""
        try:
            stream = ffmpeg.input(input_path)
            stream = stream.output(output_path, an=None, c='copy')
            stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
            return output_path
        except ffmpeg.Error as e:
            # Try re-encoding if copy fails
            try:
                stream = ffmpeg.input(input_path)
                stream = stream.output(
                    output_path, 
                    an=None,
                    vcodec='libx264',
                    preset='fast',
                    crf=23
                )
                stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
                return output_path
            except ffmpeg.Error as e2:
                raise Exception(f"FFmpeg error: {e2.stderr.decode() if e2.stderr else str(e2)}")
    
    def extract_audio(self, input_path: str, output_path: str) -> str:
        """Extract audio from video as WAV for transcription"""
        try:
            stream = ffmpeg.input(input_path)
            stream = stream.output(
                output_path,
                acodec='pcm_s16le',
                ac=1,
                ar='16000'
            )
            stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
            return output_path
        except ffmpeg.Error as e:
            raise Exception(f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}")
    
    def concat_clips(self, clip_paths: list, output_path: str) -> str:
        """Concatenate multiple clips into one video"""
        try:
            # Create input streams
            inputs = [ffmpeg.input(path) for path in clip_paths]
            
            # Concatenate
            joined = ffmpeg.concat(*inputs, v=1, a=1).node
            
            # Output
            stream = ffmpeg.output(
                joined[0], joined[1],
                output_path,
                vcodec='libx264',
                acodec='aac',
                preset='fast'
            )
            stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
            return output_path
        except ffmpeg.Error as e:
            raise Exception(f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}")
    
    def generate_thumbnail(self, input_path: str, output_path: str, time: float = 0) -> str:
        """Generate a thumbnail from video at specified time"""
        try:
            stream = ffmpeg.input(input_path, ss=time)
            stream = stream.output(output_path, vframes=1, s='320x180')
            stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
            return output_path
        except ffmpeg.Error as e:
            raise Exception(f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}")
    
    def create_clip_with_format(
        self,
        input_path: str,
        output_path: str,
        start_time: float,
        end_time: float,
        target_width: int,
        target_height: int,
        remove_audio: bool = False
    ) -> str:
        """Create a clip with specific dimensions (crop and scale for social media formats)"""
        duration = end_time - start_time
        
        try:
            # Get source video dimensions
            info = self.get_video_info(input_path)
            src_width = info['width']
            src_height = info['height']
            
            # Calculate target aspect ratio
            target_aspect = target_width / target_height
            src_aspect = src_width / src_height
            
            # Build filter chain
            # First crop to target aspect ratio, then scale to target dimensions
            if src_aspect > target_aspect:
                # Source is wider - crop width
                crop_height = src_height
                crop_width = int(src_height * target_aspect)
                crop_x = (src_width - crop_width) // 2
                crop_y = 0
            else:
                # Source is taller - crop height
                crop_width = src_width
                crop_height = int(src_width / target_aspect)
                crop_x = 0
                crop_y = (src_height - crop_height) // 2
            
            # Build FFmpeg command
            stream = ffmpeg.input(input_path, ss=start_time, t=duration)
            
            # Apply crop and scale filters
            stream = stream.filter('crop', crop_width, crop_height, crop_x, crop_y)
            stream = stream.filter('scale', target_width, target_height)
            
            # Output settings - use ultrafast preset for minimal memory usage on free hosting
            output_args = {
                'vcodec': 'libx264',
                'preset': 'ultrafast',  # Minimal memory usage
                'crf': 26,  # Slightly higher for faster encoding
                'pix_fmt': 'yuv420p',  # Ensure compatibility
                'threads': 1,  # Limit threads to reduce memory
            }
            
            if remove_audio:
                output_args['an'] = None
            else:
                output_args['acodec'] = 'aac'
                output_args['audio_bitrate'] = '96k'  # Lower bitrate for memory
            
            stream = stream.output(output_path, **output_args)
            stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
            
            return output_path
        except ffmpeg.Error as e:
            raise Exception(f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}")
    
    def compress_video(
        self, 
        input_path: str, 
        output_path: str,
        max_width: int = 1280,
        max_height: int = 720,
        crf: int = 28
    ) -> Dict[str, Any]:
        """Compress video for faster processing and smaller file size"""
        try:
            # Get original info
            original_info = self.get_video_info(input_path)
            original_size = original_info['size_mb']
            
            # Build scale filter maintaining aspect ratio
            scale_filter = f"scale='min({max_width},iw)':min'({max_height},ih)':force_original_aspect_ratio=decrease"
            
            stream = ffmpeg.input(input_path)
            stream = stream.output(
                output_path,
                vf=scale_filter,
                vcodec='libx264',
                preset='fast',
                crf=crf,
                acodec='aac',
                audio_bitrate='128k',
                movflags='+faststart'
            )
            stream.overwrite_output().run(capture_stdout=True, capture_stderr=True)
            
            # Get compressed info
            compressed_info = self.get_video_info(output_path)
            compressed_size = compressed_info['size_mb']
            
            return {
                'original_size_mb': original_size,
                'compressed_size_mb': compressed_size,
                'reduction_percent': round((1 - compressed_size / original_size) * 100, 1) if original_size > 0 else 0,
                'output_path': output_path
            }
        except ffmpeg.Error as e:
            raise Exception(f"FFmpeg compression error: {e.stderr.decode() if e.stderr else str(e)}")
