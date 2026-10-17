# 🚀 Wan 2.1 (14B) Autonomous Kaggle GPU Worker for AutoPost App

Yeh autonomous worker script **Alibaba Wan 2.1 (14B)** model ko **Kaggle ke Free Dual-T4 GPU (32GB VRAM)** par chala kar **Google Veo 3 / Sora-level photorealistic videos** render karta hai aur unhein direct AutoPost App ke **Cloud Queue** mein upload kar deta hai.

---

## 🌟 Key Highlights

1. **Google Veo 3 / Sora-level Photorealism**:
   - Poora **14-Billion parameters** wala Wan 2.1 foundation model chalta hai.
   - Cinematic architectural lighting, realistic reflections, natural physics aur authentic camera motion.
2. **$0 Kharcha — 100% Free Compute**:
   - Kaggle ke 30 Hours/Week free GPU par chalta hai.
   - Dual-T4 GPUs (32GB VRAM) par memory offloading ke sath zero crash chalta hai.
3. **Smart Video Title & Caption Fix**:
   - Technical AI prompt clutter (`Cinematic 10-second multi-angle drone sequence of a...`) ko automatically clean kar ke natural viral title banata hai (`Luxury Architectural Villa In Sahara Dunes`).
   - Yahi title video ka filename banta hai, jo Facebook page upload par video ki **natural caption** ban kar publish hoti hai.
4. **Direct Cloud Queue Upload**:
   - Har render hui video foran `https://autopost-app-1.onrender.com/pages/:id/cloud-upload` par post ho jati hai.
   - Page ke scheduled times (e.g. `04:30, 19:00`) ke mutabiq automatic Facebook par publish ho jati hai.
5. **Real-time WhatsApp Alerts**:
   - Har video upload hone par aur poora batch complete hone par Green API ke zariye aapke phone par notification aati hai.
6. **12-Hour Headless Background Execution**:
   - Aap laptop ya browser band kar dein, Kaggle Google Cloud par 12 ghantay tak khud ba khud videos banata rehta hai!

---

## 📋 Step-by-Step Guide: Kaggle Par Kaise Chalana Hai?

### Step 1: Kaggle Account & New Notebook
1. [Kaggle.com](https://www.kaggle.com) par login karein.
2. Left sidebar se **`+ Create`** -> **`New Notebook`** par click karein.

### Step 2: Notebook Import Karein
1. Top menu se **`File`** -> **`Import Notebook`** par click karein.
2. `kaggle_worker/Wan2.1_14B_AutoPost_Worker.ipynb` file ko select karke upload kar dein.

### Step 3: Kaggle GPU & Internet Settings (Important!)
Notebook ke right sidebar (**Settings**) mein jayein:
1. **Accelerator**: Select karein **`GPU T4 x2`** (Dual T4 with 32GB VRAM).
2. **Internet**: Toggle karein **`Internet On`** (Taake Hugging Face se model aur Render backend se connect ho sakay).

### Step 4: Run Mode

#### Option A: Background Execution (Laptop band kar ke chalana) — Recommended 🚀
1. Top-right corner par **`Save Version`** button par click karein.
2. Version Type mein **`Save & Run All (Commit)`** select karein aur **`Save`** par click karein.
3. Ab aap browser ya laptop band kar saktay hain! Kaggle background mein aglay 12 ghantay tak videos render kar ke aapke AutoPost Cloud Queue mein upload karta rahega aur har video par WhatsApp alert bhejta rahega.

#### Option B: Interactive Live Run
1. Cells ko top se bottom tak aik aik kar ke **`Shift + Enter`** se run karein, ya top bar se **`Run All`** dabayein.
2. Live console par video rendering aur upload ka progress nazar aayega.

---

## ⚙️ Customization (Notebook Cell 2 & 5)

- **Target Page**: `TARGET_PAGE_NAME = "Beyond Edge Abodes"` (Aap kisi bhi page ka naam likh saktay hain).
- **Model Variant**: `MODEL_VARIANT = "14B"` (Veo 3 quality) ya `"1.3B"` (Fast testing).
- **Resolution**: `RESOLUTION_PRESET = "FAST_HD"` (480x832 vertical) ya `"FULL_HD"` (720x1280).
- **Batch Size**: `BATCH_SIZE = 5` (Aap 5, 10, 20 jitni chahein set kar saktay hain).
- **Prompts**: Cell 5 ke `prompts_pool` mein aap kisi bhi niche ke prompts paste kar saktay hain.
