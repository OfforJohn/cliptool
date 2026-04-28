#!/bin/bash
# Render Build Script

# Check if ffmpeg is available
if command -v ffmpeg &> /dev/null; then
    echo "ffmpeg is available"
    ffmpeg -version
else
    echo "ffmpeg not found - it should be pre-installed on Render"
fi

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
