#!/usr/bin/env python3
"""
VPS 24/7 Photo Sync Agent for AutoPost App
===========================================
Monitors local folders on the VPS (default: C:\\AutoPhotos) and automatically
uploads new photos + captions to the corresponding Facebook Pages via AutoPost Cloud API.

Features:
- Auto-discovers active Facebook Pages & creates their dedicated folders.
- Supports folder matching by folder alias, Facebook Page ID, or Page Name.
- Atomic write protection: ensures Gemini/scraper has completely finished writing before upload.
- Automatically archives uploaded photos into '_archive/' to prevent duplicates.
- 24/7 continuous resilience: auto-reconnects on network glitches.
"""

import os
import sys
import time
import json
import shutil
import logging
from pathlib import Path
import requests

# ---------------- CONFIGURATION ----------------
DEFAULT_BACKEND_URL = os.environ.get("AUTOPOST_BACKEND_URL", "https://autopost-app-1.onrender.com")
DEFAULT_JWT_TOKEN = os.environ.get(
    "AUTOPOST_JWT_TOKEN",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWYxMGE2Zi1jYzIzLTQ0NzItODk3NC0zYWI3NTAxODg5ZGMiLCJlbWFpbCI6Im5vb3JhbGk4NjU3QGdtYWlsLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc5MDI0NDkxOSwiZXhwIjoyMTA1NjA0OTE5fQ.jjxbH8xoN5JyLBoC9J_eWsoRm2o3SaEqhDAAfsx-2aM"
)
DEFAULT_WATCH_DIR = os.environ.get("AUTOPOST_WATCH_DIR", r"C:\AutoPhotos")
POLL_INTERVAL_SECONDS = 15
PAGE_REFRESH_INTERVAL_SECONDS = 300  # Refresh targets every 5 mins

# Supported image extensions
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("AutoPost_VPS_Photo_Watcher")


class VPSPhotoWatcher:
    def __init__(self, backend_url=DEFAULT_BACKEND_URL, jwt_token=DEFAULT_JWT_TOKEN, watch_dir=DEFAULT_WATCH_DIR):
        self.backend_url = backend_url.rstrip("/")
        self.jwt_token = jwt_token.strip()
        self.watch_dir = Path(watch_dir)
        self.headers = {"Authorization": f"Bearer {self.jwt_token}"}
        self.pages = []
        self.page_lookup = {}
        self.last_page_fetch = 0
        self.file_size_cache = {}

        # Ensure root watch dir exists
        self.watch_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Initialized VPS Photo Watcher on root: {self.watch_dir.resolve()}")

    def refresh_photo_targets(self):
        """Fetches active Facebook Pages from AutoPost backend and prepares directory structure."""
        try:
            url = f"{self.backend_url}/pages/photo-targets"
            res = requests.get(url, headers=self.headers, timeout=20)
            if res.status_code == 200:
                self.pages = res.json()
                self.page_lookup = {}
                for p in self.pages:
                    # Map multiple ways to identify folder: alias, numeric pageId, id, or lower pageName
                    self.page_lookup[p["folderAlias"].lower()] = p
                    self.page_lookup[str(p["pageId"]).lower()] = p
                    self.page_lookup[p["id"].lower()] = p
                    clean_name = p["pageName"].lower().replace(" ", "_")
                    self.page_lookup[clean_name] = p
                    self.page_lookup[p["pageName"].lower()] = p

                    # Auto-create the page's dedicated folder if not exists
                    folder_path = self.watch_dir / p["folderAlias"]
                    folder_path.mkdir(exist_ok=True)
                    (folder_path / "_archive").mkdir(exist_ok=True)

                self.last_page_fetch = time.time()
                logger.info(f"Loaded {len(self.pages)} active Facebook Page targets from backend.")
            else:
                logger.warning(f"Failed to fetch photo targets: HTTP {res.status_code} - {res.text[:100]}")
        except Exception as e:
            logger.error(f"Error fetching photo targets: {e}")

    def find_target_page_for_folder(self, folder_name: str):
        """Matches a folder name to an active Facebook Page."""
        lower_name = folder_name.lower().strip()
        if lower_name in self.page_lookup:
            return self.page_lookup[lower_name]
        
        # Fuzzy match if exact alias wasn't found
        for key, page in self.page_lookup.items():
            if key in lower_name or lower_name in key:
                return page
        return None

    def is_file_ready(self, file_path: Path) -> bool:
        """Ensures the file is completely written and not currently being saved by Gemini/scraper."""
        try:
            current_size = file_path.stat().st_size
            if current_size == 0:
                return False
            key = str(file_path.resolve())
            if key not in self.file_size_cache:
                self.file_size_cache[key] = (current_size, time.time())
                return False
            prev_size, prev_time = self.file_size_cache[key]
            if current_size == prev_size and (time.time() - prev_time) >= 2.0:
                # Size remained constant for at least 2 seconds
                return True
            else:
                self.file_size_cache[key] = (current_size, time.time())
                return False
        except Exception:
            return False

    def get_caption_for_photo(self, photo_path: Path) -> str:
        """Finds matching caption .txt file or returns fallback."""
        txt_path = photo_path.with_suffix(".txt")
        if txt_path.exists():
            try:
                with open(txt_path, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except UnicodeDecodeError:
                with open(txt_path, "r", encoding="latin-1") as f:
                    return f.read().strip()

        # Fallback 1: caption.txt in the same folder
        generic_caption = photo_path.parent / "caption.txt"
        if generic_caption.exists():
            try:
                with open(generic_caption, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception:
                pass

        # Fallback 2: Clean file name
        clean_name = photo_path.stem.replace("_", " ").replace("-", " ")
        return clean_name

    def upload_photo(self, page_id: str, photo_path: Path, caption: str) -> bool:
        """Uploads the photo and caption to AutoPost Cloud API."""
        url = f"{self.backend_url}/pages/{page_id}/photo-upload"
        logger.info(f"Uploading '{photo_path.name}' to Page ID: {page_id}...")
        try:
            with open(photo_path, "rb") as f:
                files = {"photo": (photo_path.name, f, "image/jpeg")}
                data = {"caption": caption}
                res = requests.post(url, headers=self.headers, files=files, data=data, timeout=120)

            if res.status_code in (200, 201):
                res_data = res.json()
                post_id = res_data.get("postId") or res_data.get("id")
                page_name = res_data.get("pageName") or page_id
                logger.info(f"SUCCESS! Published to '{page_name}' | Post ID: {post_id}")
                return True
            else:
                logger.error(f"Upload failed: HTTP {res.status_code} - {res.text}")
                return False
        except Exception as e:
            logger.error(f"Upload exception for {photo_path.name}: {e}")
            return False

    def archive_files(self, photo_path: Path):
        """Moves photo and optional text file to _archive/ subfolder."""
        archive_dir = photo_path.parent / "_archive"
        archive_dir.mkdir(exist_ok=True)
        try:
            dest_photo = archive_dir / photo_path.name
            shutil.move(str(photo_path), str(dest_photo))

            txt_path = photo_path.with_suffix(".txt")
            if txt_path.exists():
                dest_txt = archive_dir / txt_path.name
                shutil.move(str(txt_path), str(dest_txt))

            logger.info(f"Archived {photo_path.name} to {archive_dir.name}/")
        except Exception as e:
            logger.warning(f"Could not archive {photo_path.name}: {e}")

    def scan_and_process(self):
        """Iterates over all page folders and processes ready photos."""
        # Refresh targets if never fetched or expired
        if time.time() - self.last_page_fetch > PAGE_REFRESH_INTERVAL_SECONDS or not self.pages:
            self.refresh_photo_targets()

        for item in self.watch_dir.iterdir():
            if not item.is_dir() or item.name.startswith((".", "_")):
                continue

            target_page = self.find_target_page_for_folder(item.name)
            if not target_page:
                continue

            # Find all image files
            photos = [
                p for p in item.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_EXTS and not p.name.startswith(".")
            ]

            # Sort by creation time (oldest first)
            photos.sort(key=lambda x: x.stat().st_mtime)

            for photo in photos:
                if not self.is_file_ready(photo):
                    continue

                caption = self.get_caption_for_photo(photo)
                success = self.upload_photo(target_page["id"], photo, caption)
                if success:
                    self.archive_files(photo)
                    # Clean cache key
                    self.file_size_cache.pop(str(photo.resolve()), None)
                    time.sleep(2)  # Short pause between consecutive uploads

    def run_forever(self):
        """Main loop that keeps the watcher running 24/7 on the VPS."""
        logger.info("=== VPS AutoPost Photo Watcher Started ===")
        logger.info(f"Backend Target: {self.backend_url}")
        logger.info(f"Watching Root Directory: {self.watch_dir.resolve()}")
        logger.info("Ready to receive regenerated photos from Gemini/Scraper!\n")

        self.refresh_photo_targets()

        while True:
            try:
                self.scan_and_process()
            except KeyboardInterrupt:
                logger.info("Watcher stopped by user.")
                break
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
            time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    watcher = VPSPhotoWatcher()
    watcher.run_forever()
