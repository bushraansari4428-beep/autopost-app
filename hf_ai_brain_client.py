"""
Hugging Face ZeroGPU AI Brain & Eyes Client
Provides 100% Free Nvidia A100 GPU inference for your automation scripts.
"""

import requests
import json
import time

SPACE_URL = "https://bushraa2-my-ai-brain.hf.space"
ENDPOINT = f"{SPACE_URL}/gradio_api/call/process_ai_request"

def ask_ai(prompt: str, mode: str = "⚡ Auto", image_path: str = None, hf_token: str = None) -> str:
    """
    Call the Dual AI Engine hosted on Hugging Face Spaces:
    - mode: '🧠 Brain (Qwen3-8B)', '👁️ Eyes (Qwen2.5-VL)', or '⚡ Auto'
    - image_path: Optional path to screenshot/image for Eyes mode
    - hf_token: Optional Hugging Face User Access Token for unlimited quota
    """
    headers = {}
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"

    # Handle image payload if provided
    image_payload = None
    if image_path:
        # In Gradio, upload file endpoint or file data
        import base64
        with open(image_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")
            image_payload = f"data:image/png;base64,{b64_data}"

    payload = {
        "data": [
            mode,
            image_payload,
            prompt
        ]
    }

    # Step 1: Submit job
    res = requests.post(ENDPOINT, json=payload, headers=headers, timeout=15)
    if res.status_code != 200:
        return f"Error: Request failed with status {res.status_code}: {res.text}"

    event_id = res.json().get("event_id")
    if not event_id:
        return "Error: No event_id returned from Space."

    # Step 2: Stream result SSE
    result_url = f"{ENDPOINT}/{event_id}"
    with requests.get(result_url, headers=headers, stream=True, timeout=120) as stream_res:
        for line in stream_res.iter_lines():
            if not line:
                continue
            decoded = line.decode("utf-8", errors="ignore")
            if decoded.startswith("data:"):
                raw_json = decoded[5:].strip()
                try:
                    data = json.loads(raw_json)
                    if isinstance(data, list) and len(data) > 0:
                        return data[0]
                    elif isinstance(data, dict) and "error" in data:
                        return f"Error from Space: {data['error']}"
                except Exception:
                    pass

    return "Error: Could not retrieve response from AI stream."


if __name__ == "__main__":
    print("Testing Hugging Face AI Brain...")
    response = ask_ai("Explain what is an automated TikTok poster in 1 sentence.", mode="🧠 Brain (Qwen3-8B)")
    print("\nResult:\n", response)
