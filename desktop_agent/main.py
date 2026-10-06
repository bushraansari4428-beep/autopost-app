"""
Master Launcher for AI Universal Agent
Runs PC Floating Chat Bar + Mobile Telegram Bridge.
"""

import sys
import os

# Fix Windows cp1252 console encoding crash for emojis
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure current folder is in Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from telegram_bridge import run_telegram_bot_background
from floating_bar import run_floating_bar

def main():
    print("="*60)
    print("🚀 LAUNCHING AI UNIVERSAL AGENT (PC + MOBILE)")
    print("🧠 Powered by Hugging Face ZeroGPU: Qwen3-8B + Qwen2.5-VL")
    print("="*60)

    # 1. Start Telegram Bridge in background (if configured)
    telegram_bot = run_telegram_bot_background()

    # 2. Launch PC Floating Chat Bar (Main GUI Thread)
    print("🖥️ Starting PC Floating Chat Bar...")
    run_floating_bar()

if __name__ == "__main__":
    main()
