"""
Floating Desktop Chat Bar (CustomTkinter)
A sleek, modern floating assistant bar for Windows PC.
"""

import sys
import threading
import customtkinter as ctk
from PIL import Image
from agent_core import agent
from voice_service import voice_listener

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

class FloatingChatBar(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Window settings
        self.title("AI Universal Agent")
        self.overrideredirect(True) # Frameless floating window
        self.attributes("-topmost", True) # Always on top
        self.attributes("-alpha", 0.96) # Subtle translucent glass effect

        # Position at top center of screen
        screen_w = self.winfo_screenwidth()
        self.bar_w = 750
        self.bar_h_compact = 58
        self.bar_h_expanded = 420
        self.is_expanded = False

        pos_x = (screen_w - self.bar_w) // 2
        pos_y = 45
        self.geometry(f"{self.bar_w}x{self.bar_h_compact}+{pos_x}+{pos_y}")

        # Dragging support
        self.bind("<ButtonPress-1>", self.start_drag)
        self.bind("<B1-Motion>", self.do_drag)
        self._drag_x = 0
        self._drag_y = 0

        self.setup_ui()

    def start_drag(self, event):
        self._drag_x = event.x
        self._drag_y = event.y

    def do_drag(self, event):
        x = self.winfo_x() + (event.x - self._drag_x)
        y = self.winfo_y() + (event.y - self._drag_y)
        self.geometry(f"+{x}+{y}")

    def setup_ui(self):
        # Main Outer Container
        self.main_container = ctk.CTkFrame(
            self,
            corner_radius=20,
            fg_color="#181825",
            border_width=2,
            border_color="#3B82F6"
        )
        self.main_container.pack(fill="both", expand=True, padx=2, pady=2)

        # ----------------- TOP BAR (Always Visible) -----------------
        self.top_bar = ctk.CTkFrame(self.main_container, fg_color="transparent", height=50)
        self.top_bar.pack(fill="x", padx=10, pady=6)

        # AI Status Icon
        self.status_label = ctk.CTkLabel(
            self.top_bar,
            text="🧠",
            font=("Segoe UI Emoji", 20)
        )
        self.status_label.pack(side="left", padx=(5, 8))

        # Text Input Entry
        self.entry = ctk.CTkEntry(
            self.top_bar,
            placeholder_text="Hukum dein: LESCO bill, YouTube/TikTok video download, PC search...",
            font=("Segoe UI", 13),
            fg_color="#11111B",
            border_color="#45475A",
            border_width=1,
            corner_radius=12,
            height=38
        )
        self.entry.pack(side="left", fill="x", expand=True, padx=5)
        self.entry.bind("<Return>", lambda e: self.on_submit())

        # Screenshot Quick Button
        self.btn_shot = ctk.CTkButton(
            self.top_bar,
            text="📸",
            width=36,
            height=36,
            fg_color="#313244",
            hover_color="#45475A",
            corner_radius=10,
            command=self.quick_screenshot
        )
        self.btn_shot.pack(side="left", padx=2)

        # Voice Input Button (Win+H Voice Typing)
        self.btn_mic = ctk.CTkButton(
            self.top_bar,
            text="🎙️",
            width=36,
            height=36,
            fg_color="#313244",
            hover_color="#10B981",
            corner_radius=10,
            command=self.activate_voice_typing
        )
        self.btn_mic.pack(side="left", padx=2)

        # Send / Run Button
        self.btn_send = ctk.CTkButton(
            self.top_bar,
            text="➔",
            width=40,
            height=36,
            font=("Segoe UI", 15, "bold"),
            fg_color="#3B82F6",
            hover_color="#2563EB",
            corner_radius=10,
            command=self.on_submit
        )
        self.btn_send.pack(side="left", padx=3)

        # Close / Minimize Button
        self.btn_close = ctk.CTkButton(
            self.top_bar,
            text="✕",
            width=32,
            height=36,
            font=("Segoe UI", 12, "bold"),
            fg_color="#313244",
            hover_color="#EF4444",
            corner_radius=10,
            command=self.destroy
        )
        self.btn_close.pack(side="left", padx=(3, 5))

        # ----------------- EXPANDABLE DRAWER -----------------
        self.drawer = ctk.CTkFrame(self.main_container, fg_color="#11111B", corner_radius=14)

        # Status badge row
        self.badge_frame = ctk.CTkFrame(self.drawer, fg_color="transparent")
        self.badge_frame.pack(fill="x", padx=12, pady=(8, 4))

        self.badge_status = ctk.CTkLabel(
            self.badge_frame,
            text="🟢 Ready",
            font=("Segoe UI", 11, "bold"),
            text_color="#10B981"
        )
        self.badge_status.pack(side="left")

        self.btn_collapse = ctk.CTkButton(
            self.badge_frame,
            text="Collapse ▲",
            font=("Segoe UI", 10),
            width=70,
            height=22,
            fg_color="#1E1E2E",
            hover_color="#313244",
            command=self.collapse
        )
        self.btn_collapse.pack(side="right")

        # Scrollable output textbox
        self.output_box = ctk.CTkTextbox(
            self.drawer,
            font=("Consolas", 12),
            fg_color="#181825",
            text_color="#CDD6F4",
            corner_radius=10,
            wrap="word"
        )
        self.output_box.pack(fill="both", expand=True, padx=10, pady=(2, 10))

    def expand(self):
        if not self.is_expanded:
            self.is_expanded = True
            self.drawer.pack(fill="both", expand=True, padx=10, pady=(0, 10))
            cur_x = self.winfo_x()
            cur_y = self.winfo_y()
            self.geometry(f"{self.bar_w}x{self.bar_h_expanded}+{cur_x}+{cur_y}")

    def collapse(self):
        if self.is_expanded:
            self.is_expanded = False
            self.drawer.pack_forget()
            cur_x = self.winfo_x()
            cur_y = self.winfo_y()
            self.geometry(f"{self.bar_w}x{self.bar_h_compact}+{cur_x}+{cur_y}")

    def on_submit(self):
        prompt = self.entry.get().strip()
        if not prompt:
            return

        self.entry.delete(0, "end")
        self.expand()
        self.badge_status.configure(text="🧠 Thinking on A100 GPU...", text_color="#F59E0B")
        self.output_box.delete("1.0", "end")
        self.output_box.insert("1.0", f"⚡ Instruction: {prompt}\n\n⏳ Contacting AI Brain on Hugging Face...\n")

        # Run execution in background thread to prevent UI freezing
        threading.Thread(target=self._execute_worker, args=(prompt,), daemon=True).start()

    def quick_screenshot(self):
        self.entry.delete(0, "end")
        self.entry.insert(0, "PC screen ka screenshot lo aur batao kya khula hai")
        self.on_submit()

    def activate_voice_typing(self):
        """Modern 2026 In-App Voice Listener: No Windows popup, neural Urdu/English recognition"""
        self.badge_status.configure(text="🎙️ Listening to Voice...", text_color="#38BDF8")
        self.expand()
        self.output_box.delete("1.0", "end")
        self.output_box.insert("1.0", "🎙️ Voice Listener Active... Microphone me bolein (Urdu / English)!\n")

        def on_speech(recognized_text):
            def update():
                self.entry.delete(0, "end")
                self.entry.insert(0, recognized_text)
                self.on_submit()
            self.after(0, update)

        voice_listener.listen(on_speech)

    def _execute_worker(self, prompt: str):
        result = agent.execute(prompt)
        text_out = result.get("text", "No response returned.")

        def update_ui():
            self.badge_status.configure(text="✅ Complete", text_color="#10B981")
            self.output_box.delete("1.0", "end")
            self.output_box.insert("1.0", text_out)

        self.after(0, update_ui)

def run_floating_bar():
    app = FloatingChatBar()
    app.mainloop()

if __name__ == "__main__":
    run_floating_bar()
