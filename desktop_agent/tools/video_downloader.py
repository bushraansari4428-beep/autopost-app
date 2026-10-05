"""
Social Media Video Downloader Tool
Downloads videos from YouTube, TikTok, Facebook, Instagram using yt-dlp.
"""

import os
import json
import yt_dlp

DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Downloads", "AgentVideos")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

class VideoDownloader:
    def __init__(self):
        self.download_dir = DOWNLOAD_DIR

    def download(self, url: str) -> dict:
        """Download video from any supported platform (YouTube, TikTok, FB, IG)."""
        ydl_opts = {
            'outtmpl': os.path.join(self.download_dir, '%(title).80s_%(id)s.%(ext)s'),
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                # If merged to mkv or mp4
                if not os.path.exists(filename):
                    base, _ = os.path.splitext(filename)
                    if os.path.exists(base + ".mp4"):
                        filename = base + ".mp4"
                    elif os.path.exists(base + ".mkv"):
                        filename = base + ".mkv"

                return {
                    "success": True,
                    "title": info.get("title", "Video"),
                    "file_path": filename,
                    "duration": info.get("duration"),
                    "uploader": info.get("uploader", "Unknown"),
                    "message": f"Successfully downloaded: {info.get('title', 'Video')} to {filename}"
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def search_and_download(self, query: str, limit: int = 1) -> dict:
        """Search YouTube for a query and download the top video."""
        search_url = f"ytsearch{limit}:{query}"
        return self.download(search_url)

video_downloader = VideoDownloader()
