"""
In-App Native Neural Voice Recognition Engine (2026 Edition)
Uses sounddevice + Google Neural Speech Recognizer for high accuracy Roman Urdu / Urdu / English.
Completely in-app: NO pop-ups, NO browser windows, NO Windows dictation bars!
"""

import io
import wave
import threading
import time
import numpy as np
import sounddevice as sd
import speech_recognition as sr

class NativeVoiceEngine:
    def __init__(self):
        self.samplerate = 16000
        self.channels = 1
        self.is_recording = False
        self.stream = None
        self.audio_frames = []
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True

    def toggle(self, on_status_change, on_result):
        """Toggle recording on/off on button click."""
        if not self.is_recording:
            self.start_recording(on_status_change, on_result)
        else:
            self.stop_recording(on_status_change, on_result)

    def start_recording(self, on_status_change, on_result):
        if self.is_recording:
            return

        self.audio_frames = []
        self.is_recording = True
        on_status_change("recording")

        def audio_callback(indata, frames, time_info, status):
            if self.is_recording:
                self.audio_frames.append(indata.copy())

        try:
            self.stream = sd.InputStream(
                samplerate=self.samplerate,
                channels=self.channels,
                dtype="int16",
                callback=audio_callback
            )
            self.stream.start()

            # Auto-stop after 8 seconds if user doesn't manually click stop
            def auto_timer():
                time.sleep(8)
                if self.is_recording:
                    self.stop_recording(on_status_change, on_result)

            threading.Thread(target=auto_timer, daemon=True).start()

        except Exception as e:
            self.is_recording = False
            on_status_change("error", f"Microphone error: {e}")

    def stop_recording(self, on_status_change, on_result):
        if not self.is_recording:
            return

        self.is_recording = False
        on_status_change("processing")

        try:
            if self.stream:
                self.stream.stop()
                self.stream.close()
                self.stream = None
        except Exception:
            pass

        # Process audio in background thread so UI doesn't hang
        threading.Thread(target=self._transcribe_worker, args=(self.audio_frames, on_status_change, on_result), daemon=True).start()

    def _transcribe_worker(self, frames, on_status_change, on_result):
        if not frames:
            on_status_change("error", "No audio recorded.")
            return

        try:
            audio_array = np.concatenate(frames, axis=0)
            wav_bytes = io.BytesIO()
            with wave.open(wav_bytes, "wb") as wf:
                wf.setnchannels(self.channels)
                wf.setsampwidth(2)
                wf.setframerate(self.samplerate)
                wf.writeframes(audio_array.tobytes())
            wav_bytes.seek(0)

            with sr.AudioFile(wav_bytes) as source:
                audio = self.recognizer.record(source)

            # Transcribe: First try Urdu (Pakistan), then fallback to English
            text = None
            try:
                text = self.recognizer.recognize_google(audio, language="ur-PK")
            except sr.UnknownValueError:
                try:
                    text = self.recognizer.recognize_google(audio, language="en-US")
                except Exception:
                    text = None
            except Exception:
                try:
                    text = self.recognizer.recognize_google(audio, language="en-US")
                except Exception:
                    text = None

            if text and text.strip():
                on_status_change("idle")
                on_result(text.strip())
            else:
                on_status_change("error", "Aawaz samajh nahi aayi. Baraye meherbani dubara bolein.")

        except Exception as e:
            on_status_change("error", f"Transcription error: {e}")

voice_engine = NativeVoiceEngine()
