"""
Modern 2026 Web Speech Voice Listener for AI Universal Agent
Uses Microsoft Edge's Neural Speech Engine (Zero dependency, high Urdu/Roman Urdu accuracy).
"""

import os
import json
import subprocess
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AI Voice Listener</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', system-ui, sans-serif; }
        body {
            background: #11111b;
            color: #cdd6f4;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
            border: 2px solid #89b4fa;
            border-radius: 16px;
        }
        .mic-container {
            position: relative;
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
        }
        .mic-wave {
            position: absolute;
            width: 100%;
            height: 100%;
            background: rgba(137, 180, 250, 0.25);
            border-radius: 50%;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(0.9); opacity: 0.8; }
            50% { transform: scale(1.3); opacity: 0.2; }
            100% { transform: scale(0.9); opacity: 0.8; }
        }
        .mic-icon {
            font-size: 38px;
            z-index: 2;
        }
        .status {
            font-size: 13px;
            color: #a6adc8;
            margin-bottom: 6px;
            font-weight: 500;
        }
        .live-text {
            font-size: 14px;
            color: #89b4fa;
            font-weight: bold;
            padding: 0 16px;
            text-align: center;
            min-height: 24px;
        }
        .btn-stop {
            margin-top: 10px;
            background: #313244;
            border: 1px solid #45475a;
            color: #cdd6f4;
            padding: 4px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 11px;
        }
        .btn-stop:hover { background: #f38ba8; color: #11111b; }
    </style>
</head>
<body>
    <div class="mic-container">
        <div class="mic-wave"></div>
        <div class="mic-icon">🎙️</div>
    </div>
    <div class="status" id="status">Sun raha hoon... Bolein (Urdu / English)</div>
    <div class="live-text" id="transcript">...</div>
    <button class="btn-stop" onclick="window.close()">Cancel</button>

    <script>
        const statusEl = document.getElementById('status');
        const transcriptEl = document.getElementById('transcript');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            statusEl.innerText = "Speech Recognition not supported in this browser.";
        } else {
            const recognition = new SpeechRecognition();
            recognition.lang = 'ur-PK'; // Urdu & Roman Urdu priority
            recognition.interimResults = true;
            recognition.continuous = false;

            recognition.onstart = () => {
                statusEl.innerText = "🎙️ Sun raha hoon... Bolein!";
            };

            recognition.onresult = (event) => {
                let current = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    current += event.results[i][0].transcript;
                }
                transcriptEl.innerText = current;

                if (event.results[0].isFinal) {
                    statusEl.innerText = "✅ Sending to Agent...";
                    fetch('/speech_result', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: current })
                    }).then(() => {
                        setTimeout(() => window.close(), 400);
                    }).catch(() => window.close());
                }
            };

            recognition.onerror = (e) => {
                statusEl.innerText = "⚠️ Voice error: " + (e.error || "Retry");
                // Fallback to English if Urdu error
                if (e.error === 'no-speech') {
                    setTimeout(() => window.close(), 1500);
                }
            };

            recognition.onend = () => {
                // If closed without final
                setTimeout(() => window.close(), 500);
            };

            try {
                recognition.start();
            } catch (err) {
                console.error(err);
            }
        }
    </script>
</body>
</html>
"""

class VoiceRequestHandler(BaseHTTPRequestHandler):
    on_text_received = None

    def do_GET(self):
        if self.path == "/voice" or self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_CONTENT.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/speech_result":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                text = data.get("text", "").strip()
                if text and VoiceRequestHandler.on_text_received:
                    VoiceRequestHandler.on_text_received(text)
            except Exception:
                pass
            self.send_response(200)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress logging
        pass

class ModernVoiceListener:
    def __init__(self, port: int = 8765):
        self.port = port
        self.server = None
        self.edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        self._start_server()

    def _start_server(self):
        try:
            VoiceRequestHandler.on_text_received = self._handle_incoming_text
            self.server = HTTPServer(("127.0.0.1", self.port), VoiceRequestHandler)
            threading.Thread(target=self.server.serve_forever, daemon=True).start()
        except Exception as e:
            print(f"Voice server notice: {e}")

    def _handle_incoming_text(self, text: str):
        if hasattr(self, "callback") and self.callback:
            self.callback(text)

    def listen(self, callback):
        """Open the sleek voice popup and listen for speech."""
        self.callback = callback
        url = f"http://127.0.0.1:{self.port}/voice"
        if os.path.exists(self.edge_path):
            cmd = f'"{self.edge_path}" --app="{url}" --window-size=360,250'
            subprocess.Popen(cmd, shell=True)
        else:
            import webbrowser
            webbrowser.open(url)

voice_listener = ModernVoiceListener()
