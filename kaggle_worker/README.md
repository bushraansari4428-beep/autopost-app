# 👑 Alibaba Wan 2.1 (14B) Autonomous GPU Worker for AutoPost App

Yeh autonomous worker script **sirf aur sirf Alibaba Wan 2.1 (14B)** — jo **Google Veo 3 / Sora-grade realism** deta hai — usko **Kaggle ke Free Dual-T4 GPU** par chala kar videos render karta hai aur unhein direct AutoPost App ke **Cloud Queue** mein upload kar deta hai.

Koi 1.3B ya low-tier model nahi — **hamesha 14-Billion foundation model hi use hoga**.

---

## 🌟 Key Highlights

1. **Exclusively Wan 2.1 (14B)**:
   - Poora **14-Billion parameters** wala Wan 2.1 foundation model chalta hai (`Wan-AI/Wan2.1-T2V-14B-Diffusers`).
   - Architectural reflections, volumetric lighting, aur realistic physics bilkul authentic cinematic standard par aati hain.
2. **Kaggle GPU Memory Optimization**:
   - `pipe.enable_model_cpu_offload()` aur `vae.enable_tiling()` ke sath yeh 14B model Kaggle ke 16GB GPU VRAM ke andar bina kisi Out-Of-Memory (OOM) crash ke smooth execute hota hai.
3. **Smart Video Title & Caption Fix**:
   - Technical AI prompt clutter (`Cinematic 10-second multi-angle drone sequence of a...`) ko automatically clean kar ke natural viral title banata hai (`Luxury Architectural Villa In Sahara Dunes`).
   - Yahi title video ka filename banta hai, jo Facebook page upload par video ki **natural caption** ban kar publish hoti hai.
4. **Direct Cloud Queue Upload**:
   - Har render hui video foran `https://autopost-app-1.onrender.com/pages/:id/cloud-upload` par post ho jati hai.
   - Page ke scheduled times (e.g. `Beyond Edge Abodes` ke `04:30, 19:00`) ke mutabiq automatic Facebook par publish ho jati hai.
5. **Real-time WhatsApp Alerts**:
   - Har video upload hone par aur poora batch complete hone par Green API ke zariye aapke phone (`+92 340 0060008`) par notification aati hai.
6. **12-Hour Headless Background Execution**:
   - Aap laptop ya browser band kar dein, Kaggle Google Cloud par 12 ghantay tak khud ba khud videos banata rehta hai!

---

## 📋 Step-by-Step Guide: Kaggle Par Kaise Chalana Hai?

### Step 1: Kaggle Account & New Notebook
1. [Kaggle.com](https://www.kaggle.com) par login karein.
2. Left sidebar se **`+ Create`** -> **`New Notebook`** par click karein.

### Step 2: Notebook Import Karein
1. Top menu se **`File`** -> **`Import Notebook`** par click karein.
2. Apne computer se `Auto Post App/kaggle_worker/Wan2.1_14B_AutoPost_Worker.ipynb` file ko select karke upload kar dein.

### Step 3: Kaggle GPU & Internet Settings (Important!)
Notebook ke right sidebar (**Settings / Session options**) mein:
1. **Accelerator**: Select karein **`GPU T4 x2`** (Dual T4 with 32GB VRAM).
2. **Internet**: Toggle karein **`Internet On`** (Taake Hugging Face se 14B model aur Render backend se connect ho sakay).

### Step 4: Run Mode

#### Option A: Background Execution (Laptop band kar ke chalana) — Recommended 🚀
1. Top-right corner par **`Save Version`** button par click karein.
2. Version Type mein **`Save & Run All (Commit)`** select karein aur **`Save`** par click karein.
3. Ab aap browser ya laptop band kar saktay hain! Kaggle background mein aglay 12 ghantay tak 14B videos render kar ke aapke AutoPost Cloud Queue mein upload karta rahega aur har video par WhatsApp alert bhejta rahega.

#### Option B: Interactive Live Run
1. Cells ko top se bottom tak aik aik kar ke **`Shift + Enter`** se run karein, ya top bar se **`Run All`** dabayein.
2. Live console par 14B video rendering aur upload ka progress nazar aayega.

---

## ⚙️ Customization (Notebook Cell 2 & 5)

- **Target Page**: `TARGET_PAGE_NAME = "Beyond Edge Abodes"` (Aap kisi bhi page ka naam likh saktay hain).
- **Resolution**: `RESOLUTION_PRESET = "FAST_HD"` (480x832 vertical) ya `"FULL_HD"` (720x1280).
- **Batch Size**: `BATCH_SIZE = 5` (Aap 5, 10, 20 jitni chahein set kar saktay hain).
- **Prompts**: Cell 5 ke `prompts_pool` mein aap kisi bhi niche ke prompts paste kar saktay hain.
