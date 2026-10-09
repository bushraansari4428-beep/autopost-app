'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Download,
  Copy,
  Server,
  CheckCircle2,
  AlertCircle,
  FileText,
  Zap,
  Film,
  Compass,
  Layers,
  Send,
  Check,
  Loader2,
  Terminal,
  Video,
  Upload,
  Link as LinkIcon,
  Eye,
  Sliders,
  ArrowRight,
  ShieldCheck,
  CheckCheck,
  X
} from 'lucide-react';

interface FixedDNA {
  camera_and_medium?: string;
  timing_breakdown?: string[];
  negative_prompt?: string;
  audio_rules?: string;
  structural_template?: string;
}

interface HierarchicalMatrix {
  sub_genres?: string[];
  locations?: string[];
  subjects_or_anomalies?: string[];
  tools_and_probes?: string[];
  scale_anchors?: string[];
  climaxes?: string[];
}

interface PromptMatrix {
  niche_name: string;
  theme_summary: string;
  fixed_dna?: FixedDNA;
  hierarchical_matrix?: HierarchicalMatrix;
  subjects?: string[];
  locations?: string[];
  actions_or_hooks?: string[];
  camera_styles?: string[];
}

interface PromptItem {
  index: number;
  sub_genre?: string;
  location: string;
  subject: string;
  text: string;
}

interface VideoAnalysisResult {
  originalAnalysis?: {
    visual_hook?: string;
    camera_and_pov?: string;
    tool_and_anchor?: string;
    climax?: string;
    audio_elements?: string;
  };
  reSkinnedConcept?: {
    title?: string;
    core_hook?: string;
    new_biome?: string;
    new_tool?: string;
    new_scale_anchor?: string;
    new_climax?: string;
  };
  masterPrompt?: string;
  matrix?: PromptMatrix;
  testPrompts?: PromptItem[];
}

export default function PromptGeneratorPage() {
  // Navigation Mode: Video Reverse Engineer vs Direct Master Prompt
  const [mainMode, setMainMode] = useState<'video_engineer' | 'master_prompt'>('video_engineer');

  // Video Reverse Engineer state
  const [videoInputMode, setVideoInputMode] = useState<'url' | 'upload'>('url');
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [sampleCount, setSampleCount] = useState<number>(5);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState<boolean>(false);
  const [videoAnalysisStep, setVideoAnalysisStep] = useState<string>('');
  const [videoAnalysisResult, setVideoAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [copiedTestIdx, setCopiedTestIdx] = useState<number | null>(null);
  const [copiedAllTest, setCopiedAllTest] = useState<boolean>(false);
  const [copiedMasterPrompt, setCopiedMasterPrompt] = useState<boolean>(false);
  const [fbSecurityAlert, setFbSecurityAlert] = useState<boolean>(false);

  // Direct Master Prompt state
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [targetCount, setTargetCount] = useState<number>(100);
  const [batchSize, setBatchSize] = useState<number>(5);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [matrix, setMatrix] = useState<PromptMatrix | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<PromptItem | null>(null);
  const [viewMode, setViewMode] = useState<'txt' | 'cards'>('txt');

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'blueprint' | 'elements'>('blueprint');

  // VPS Modal state
  const [showVpsModal, setShowVpsModal] = useState<boolean>(false);
  const [vpsUrl, setVpsUrl] = useState<string>('');
  const [isSendingToVps, setIsSendingToVps] = useState<boolean>(false);
  const [vpsSuccessMsg, setVpsSuccessMsg] = useState<string>('');

  const stopSignalRef = useRef<boolean>(false);
  const outputBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved state from localStorage
  useEffect(() => {
    const savedPrompt = localStorage.getItem('last_master_prompt');
    if (savedPrompt) setMasterPrompt(savedPrompt);
    const savedVps = localStorage.getItem('vps_video_generator_url');
    if (savedVps) setVpsUrl(savedVps);
  }, []);

  const handleUseSamplePrompt = () => {
    const sample = `Create a 10-second vertical 9:16 raw smartphone video shot strictly from the rear camera in pure continuous first-person POV, with absolutely no selfie camera, no face-cam, and no picture-in-picture overlay. The setting is a cold, overcast sub-alpine scree trail covered in loose grey slate stones, dry yellow tussock grass, and cool mountain air. In the first second, the camera points down at a flat 1-meter natural grey slate slab embedded in the dirt; the rock is sharply split down a natural center seam where the left half is crusted in thick white sub-zero frost, while the right half visibly radiates shimmering hot thermal heat-waves into the cold air. From 0–3 seconds, show cautious handheld steps crunching on loose gravel, phone bobbing with natural breathing, camera auto-exposure balancing the bright white frost against the dark wet rock, and howling cold mountain wind audio. From 3–6 seconds, lean down within eight inches of the rock seam; an ordinary bare hand holds a dented steel canteen and pours a steady thin stream of clear water directly across the center dividing line, with a tiny dried pine needle resting on the rock rim to anchor realistic physical scale. From 6–8 seconds, the poured water hits both sides simultaneously; the liquid on the frosted left side instantly flash-freezes into jagged white frost ice, while the water on the right half violently boils, hissing and vaporizing instantly into billowing steam. From 8–10 seconds, extreme thermal shock causes the rock slab to violently split with an explosive gunshot-like crack, blasting steam and sharp slate fragments toward the operator; the operator gasps in terror, violently stumbles backward, and the recording terminates abruptly with NO face or person visible. Audio: crunching gravel footsteps, howling sub-alpine wind, water pouring from metal canteen, simultaneous sizzling boil and cracking ice, deafening gunshot rock fracture, and panicked sharp breathing.

## Negative prompt
human face, man face, selfie, front camera, picture-in-picture, PIP, face-cam, reaction face, talking head, vlogger overlay, avatar, split screen, napkins, tissues, paper, glass bowl, acrylic prop, cinematic CGI sheen, smooth gimbal stabilization, fantasy glowing magic runes, blue energy shields, sci-fi forcefields, cartoon water effects, alien technology, dramatic movie trailer soundtrack, bass drops, sound design risers, motion blur glitches, subtitles, text overlays, logos, watermarks, extra fingers, deformed hands, and narrative explanations. Maintain the convincing, unpolished aesthetic of authentic viral mobile found-footage captured spontaneously on a smartphone.`;
    setMasterPrompt(sample);
  };

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const formatPromptsText = (items: PromptItem[]): string => {
    return items
      .map(p => `--- PROMPT ${p.index} ---\n${p.text.trim()}\n\n`)
      .join('');
  };

  // ---------------- 🎬 VIDEO REVERSE-ENGINEERING ACTIONS ----------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedVideoFile(e.target.files[0]);
    }
  };

  const handleAnalyzeVideo = async () => {
    setErrorMessage('');
    setStatusMessage('');

    if (videoInputMode === 'url' && !videoUrlInput.trim()) {
      setErrorMessage('Please enter a video URL (TikTok, Instagram Reels, Facebook, YouTube Shorts, or direct .mp4 link).');
      return;
    }
    if (videoInputMode === 'upload' && !selectedVideoFile) {
      setErrorMessage('Please select or upload a 10-second .mp4 video file.');
      return;
    }

    setIsAnalyzingVideo(true);
    setVideoAnalysisStep('Uploading video stream to Gemini 3.8 Video Vision...');

    try {
      const formData = new FormData();
      if (videoInputMode === 'upload' && selectedVideoFile) {
        formData.append('video', selectedVideoFile);
      } else if (videoInputMode === 'url' && videoUrlInput.trim()) {
        formData.append('videoUrl', videoUrlInput.trim());
      }
      formData.append('sampleCount', String(sampleCount));

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      setVideoAnalysisStep('Gemini 3.8 analyzing continuous video motion, POV wobble, timing & Foley audio...');

      const res = await fetch('/api/prompts/reverse-engineer-video', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        let cleanMsg = '';
        try {
          const rawText = await res.text();
          try {
            const errObj = JSON.parse(rawText);
            cleanMsg = errObj.message || errObj.error || (Array.isArray(errObj.message) ? errObj.message.join(', ') : '');
          } catch (_) {
            if (res.status === 504 || rawText.includes('504') || rawText.includes('Gateway Timeout')) {
              cleanMsg = 'Server timeout (504): Server response late ho gaya. Baraye meherbani dobara try karein.';
            } else if (res.status === 503 || rawText.includes('503') || rawText.includes('Service Unavailable')) {
              cleanMsg = 'AI Model par temporary demand spike (503) aya hai. Baraye meherbani 5 seconds baad dobara koshish karein.';
            } else if (res.status === 413 || rawText.includes('413') || rawText.includes('Payload Too Large')) {
              cleanMsg = 'Video file ka size bohot bara hai. Baraye meherbani chhoti clip upload karein.';
            } else {
              cleanMsg = rawText.slice(0, 200);
            }
          }
        } catch (readErr: any) {
          cleanMsg = `Server error (${res.status}): ${readErr.message || 'Could not read response'}`;
        }
        throw new Error(cleanMsg || `Server error (${res.status})`);
      }

      setVideoAnalysisStep(`Synthesizing brand-new concept & generating ${sampleCount} test prompts with Qwen 3.8...`);
      const data: VideoAnalysisResult = await res.json();

      if (data.originalAnalysis && data.reSkinnedConcept) {
        setVideoAnalysisResult(data);
        setFbSecurityAlert(false);
        setStatusMessage(`Successfully reverse-engineered video and generated ${data.testPrompts?.length || sampleCount} test prompts!`);
      } else {
        throw new Error('Analysis completed but returned incomplete concept payload.');
      }
    } catch (err: any) {
      console.error('Video reverse-engineering error:', err);
      const msg = err.message || 'Video analysis failed';
      const isFbBlocked =
        (videoUrlInput && (videoUrlInput.includes('facebook.com') || videoUrlInput.includes('fb.watch'))) ||
        msg.toLowerCase().includes('facebook') ||
        msg.toLowerCase().includes('security wall');

      if (isFbBlocked) {
        setFbSecurityAlert(true);
      }
      setErrorMessage(msg);
    } finally {
      setIsAnalyzingVideo(false);
      setVideoAnalysisStep('');
    }
  };

  const handleApproveAndExpand = (bulkTarget: number = 500) => {
    if (!videoAnalysisResult?.masterPrompt || !videoAnalysisResult?.matrix) return;
    setMasterPrompt(videoAnalysisResult.masterPrompt);
    setMatrix(videoAnalysisResult.matrix);
    setTargetCount(bulkTarget);
    setPrompts(videoAnalysisResult.testPrompts || []);
    setMainMode('master_prompt');
    setStatusMessage(`Concept approved! Preloaded ${videoAnalysisResult.testPrompts?.length || 0} test prompts. Ready to generate up to ${bulkTarget} prompts.`);
  };

  const handleCopyTestPrompt = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedTestIdx(idx);
    setTimeout(() => setCopiedTestIdx(null), 2000);
  };

  const handleCopyAllTestPrompts = async () => {
    if (!videoAnalysisResult?.testPrompts) return;
    const txt = formatPromptsText(videoAnalysisResult.testPrompts);
    await navigator.clipboard.writeText(txt);
    setCopiedAllTest(true);
    setTimeout(() => setCopiedAllTest(false), 2500);
  };

  const handleDownloadTestPrompts = () => {
    if (!videoAnalysisResult?.testPrompts || videoAnalysisResult.testPrompts.length === 0) return;
    const cleanTitle = (videoAnalysisResult.reSkinnedConcept?.title || 'Test_Batch')
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const filename = `${cleanTitle}_${videoAnalysisResult.testPrompts.length}_test_samples.txt`;
    const textContent = formatPromptsText(videoAnalysisResult.testPrompts);

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendTestBatchToVps = () => {
    if (!videoAnalysisResult?.testPrompts || videoAnalysisResult.testPrompts.length === 0) return;
    setPrompts(videoAnalysisResult.testPrompts);
    if (videoAnalysisResult.matrix) {
      setMatrix(videoAnalysisResult.matrix);
    }
    setShowVpsModal(true);
  };

  // ---------------- 📝 DIRECT PROMPT GENERATOR ACTIONS ----------------
  const handleStartGeneration = async () => {
    if (!masterPrompt.trim()) {
      setErrorMessage('Please enter a Master Prompt first!');
      return;
    }

    setErrorMessage('');
    stopSignalRef.current = false;
    setIsPaused(false);
    localStorage.setItem('last_master_prompt', masterPrompt);

    let activeMatrix = matrix;

    // Analyze Master Prompt if not already done
    if (!activeMatrix) {
      setIsAnalyzing(true);
      setStatusMessage('Analyzing Master Prompt structure with Qwen 3.8...');
      try {
        const res = await fetch('/api/prompts/analyze', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ masterPrompt })
        });
        const data = await res.json();
        if (data.success && data.matrix) {
          activeMatrix = data.matrix;
          setMatrix(data.matrix);
        } else {
          throw new Error(data.error || 'Failed to analyze master prompt');
        }
      } catch (err: any) {
        setErrorMessage(`Analysis failed: ${err.message}`);
        setIsAnalyzing(false);
        return;
      }
      setIsAnalyzing(false);
    }

    if (!activeMatrix) {
      setErrorMessage('Could not initialize variation matrix.');
      return;
    }

    // Batch Generation Loop
    setIsGenerating(true);
    setStatusMessage('Generating prompts in background...');

    let currentIdx = prompts.length + 1;
    let accumulated = [...prompts];

    while (currentIdx <= targetCount && !stopSignalRef.current) {
      const needed = Math.min(batchSize, targetCount - currentIdx + 1);
      try {
        const res = await fetch('/api/prompts/generate-batch', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            masterPrompt,
            matrix: activeMatrix,
            startIdx: currentIdx,
            count: needed
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          setErrorMessage(`Server response ${res.status}: ${errText.slice(0, 120)}`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        const data = await res.json();
        if (data.success && Array.isArray(data.prompts) && data.prompts.length > 0) {
          setErrorMessage('');
          accumulated = [...accumulated, ...data.prompts];
          setPrompts([...accumulated]);
          setCurrentPrompt(data.prompts[data.prompts.length - 1]);
          currentIdx += data.prompts.length;

          if (outputBoxRef.current) {
            outputBoxRef.current.scrollTop = outputBoxRef.current.scrollHeight;
          }
        } else {
          setErrorMessage(data?.error || data?.message || 'Retrying prompt generation...');
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err: any) {
        console.error('Batch generation error:', err);
        setErrorMessage(`Network error: ${err.message}. Retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }

      await new Promise(r => setTimeout(r, 100));
    }

    setIsGenerating(false);
    if (currentIdx > targetCount) {
      setStatusMessage(`Completed! All ${targetCount} prompts generated successfully.`);
    } else if (stopSignalRef.current) {
      setIsPaused(true);
      setStatusMessage(`Paused at Prompt ${accumulated.length}. You can resume anytime.`);
    }
  };

  const handlePause = () => {
    stopSignalRef.current = true;
    setIsGenerating(false);
    setIsPaused(true);
    setStatusMessage(`Paused. Generated ${prompts.length} of ${targetCount} prompts.`);
  };

  const handleReset = () => {
    stopSignalRef.current = true;
    setIsGenerating(false);
    setIsPaused(false);
    setPrompts([]);
    setCurrentPrompt(null);
    setMatrix(null);
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleDownloadTxt = () => {
    if (prompts.length === 0) return;
    const cleanNiche = (matrix?.niche_name || 'Prompts')
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const filename = `${cleanNiche}_${prompts.length}_prompts.txt`;
    const textContent = formatPromptsText(prompts);

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = async () => {
    if (prompts.length === 0) return;
    const textContent = formatPromptsText(prompts);
    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendToVps = async () => {
    if (prompts.length === 0) {
      setErrorMessage('Please generate prompts before transferring to VPS!');
      return;
    }
    setIsSendingToVps(true);
    setVpsSuccessMsg('');

    if (vpsUrl.trim()) {
      localStorage.setItem('vps_video_generator_url', vpsUrl.trim());
    }

    const cleanNiche = (matrix?.niche_name || 'Prompts')
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const filename = `${cleanNiche}_${prompts.length}_prompts.txt`;
    const textContent = formatPromptsText(prompts);

    try {
      const res = await fetch('/api/prompts/push-to-vps', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          filename,
          content: textContent,
          vpsUrl: vpsUrl.trim() || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setVpsSuccessMsg(data.message || 'Prompt file saved & ready for bot rendering!');
      } else {
        setErrorMessage(data.message || 'VPS transfer encountered an issue.');
      }
    } catch (e: any) {
      setErrorMessage(`Transfer error: ${e.message}`);
    } finally {
      setIsSendingToVps(false);
    }
  };

  const progressPercent = Math.min(100, Math.round((prompts.length / targetCount) * 100));

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto custom-scrollbar p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 rounded-2xl shadow-lg shadow-purple-500/25 border border-purple-500/30">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Prompt Generator & Reverse Engineering
                </h1>
                <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                  <Video className="w-3 h-3 text-blue-400" />
                  Gemini 3.8 Video Vision
                </span>
                <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Qwen 3.8 Ultra
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Reverse-engineer viral 10-second videos with AI Video Vision or generate bulk prompts from text.
              </p>
            </div>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setMainMode('video_engineer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              mainMode === 'video_engineer'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Reverse Engineer</span>
          </button>
          <button
            type="button"
            onClick={() => setMainMode('master_prompt')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              mainMode === 'master_prompt'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Master Prompt Generator</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-red-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0 text-indigo-400" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage('')} className="text-indigo-400 hover:text-indigo-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 📹 TAB 1: VIDEO REVERSE ENGINEER (GEMINI 3.8 VIDEO VISION)      */}
      {/* ============================================================== */}
      {mainMode === 'video_engineer' && (
        <div className="space-y-6">
          {/* Video Input Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-blue-400" />
                  Native Video Reverse-Engineering Engine
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gemini 3.8 Flash watches the complete 10-second video stream natively (POV motion, camera wobble, physical interaction & Foley audio) to craft a 100% original re-skinned concept.
                </p>
              </div>

              {/* Source Mode Toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setVideoInputMode('url')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    videoInputMode === 'url'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Video Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoInputMode('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    videoInputMode === 'upload'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .mp4</span>
                </button>
              </div>
            </div>

            {/* Input Selection */}
            {videoInputMode === 'url' ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Paste Video URL (TikTok, Reels, Shorts, Facebook, Direct MP4)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={videoUrlInput}
                      onChange={e => setVideoUrlInput(e.target.value)}
                      placeholder="https://www.tiktok.com/@creator/video/... or direct .mp4 link"
                      disabled={isAnalyzingVideo}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                    />
                  </div>
                  {videoUrlInput && (
                    <button
                      type="button"
                      onClick={() => setVideoUrlInput('')}
                      className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-colors"
                      title="Clear"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Facebook Security Alert Banner with 1-Click Action */}
                {fbSecurityAlert && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 animate-fadeIn mt-2">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wide">
                          Facebook Security Notice
                        </h4>
                        <p className="text-xs text-amber-300 leading-relaxed">
                          Facebook cloud servers ko direct Reel download ki ijazat nahi deta. Video ko apne mobile ya PC se download karke direct <strong>Upload .mp4</strong> tab ke zariye upload karein taake Gemini 3.8 Video Vision ise foran analyze kar sake!
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 pl-8">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoInputMode('upload');
                          setFbSecurityAlert(false);
                          setErrorMessage('');
                          setTimeout(() => fileInputRef.current?.click(), 100);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Switch to Upload .mp4 & Select Video</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFbSecurityAlert(false)}
                        className="px-3 py-1.5 rounded-lg text-xs text-amber-400 hover:text-amber-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Upload 10-Second Video Clip (.mp4, .mov, max 50MB)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-950/60 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-slate-950"
                >
                  {selectedVideoFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                        <Video className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-200">{selectedVideoFile.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {(selectedVideoFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for analysis
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedVideoFile(null);
                        }}
                        className="ml-4 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-300">
                        Click to select or drag & drop 10-second .mp4 video
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Supports MP4, MOV, WebM • Under 50MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Safety Gate: Initial Test Batch Selector */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Safety Verification: Initial Test Batch
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  Inspect quality before expanding to 500 or 1,000 prompts
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { count: 5, label: '5 Prompts', desc: 'Quick Test' },
                  { count: 10, label: '10 Prompts', desc: 'Recommended' },
                  { count: 15, label: '15 Prompts', desc: 'Deep Test' },
                  { count: 20, label: '20 Prompts', desc: 'Full Sample' }
                ].map(opt => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => setSampleCount(opt.count)}
                    disabled={isAnalyzingVideo}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      sampleCount === opt.count
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">{opt.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Button With Active Rotating Sign */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAnalyzeVideo}
                disabled={isAnalyzingVideo}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 disabled:opacity-50"
              >
                {isAnalyzingVideo ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>Analyzing Video with Gemini 3.8 Video Vision...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-blue-200" />
                    <span>Analyze Video with Gemini 3.8 & Generate {sampleCount} Test Prompts</span>
                  </>
                )}
              </button>
            </div>

            {/* Active Analysis Status Indicator */}
            {isAnalyzingVideo && videoAnalysisStep && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-center gap-2.5 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                <span>{videoAnalysisStep}</span>
              </div>
            )}
          </div>

          {/* ========================================================== */}
          {/* RESULTS DISPLAY: BREAKDOWN, RE-SKINNED CONCEPT & TEST BATCH */}
          {/* ========================================================== */}
          {videoAnalysisResult && (
            <div className="space-y-6 animate-fadeIn">
              {/* Top Banner: Verification Alert */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Concept Synthesized & {videoAnalysisResult.testPrompts?.length || sampleCount} Test Prompts Ready
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Inspect the breakdown and test prompts below. When satisfied, expand to 500 or 1,000 prompts with 1 click.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApproveAndExpand(500)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Approve & Expand to 500 Prompts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApproveAndExpand(1000)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Expand to 1,000 Prompts</span>
                  </button>
                </div>
              </div>

              {/* Grid: Original Deconstruction vs 100% Original Re-Skin */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Card 1: Original Video Deconstruction */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Original Video Deconstruction
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      Gemini 3.8 Video Vision
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                        Visual Hook (0–2s)
                      </span>
                      <p className="text-slate-200 mt-1 leading-relaxed">
                        {videoAnalysisResult.originalAnalysis?.visual_hook || 'Continuous anomaly hook'}
                      </p>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                        Handheld POV & Wobble
                      </span>
                      <p className="text-slate-200 mt-1 leading-relaxed">
                        {videoAnalysisResult.originalAnalysis?.camera_and_pov || '9:16 continuous rear smartphone POV'}
                      </p>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                        Physical Tool & Scale Anchor (3–6s)
                      </span>
                      <p className="text-slate-200 mt-1 leading-relaxed">
                        {videoAnalysisResult.originalAnalysis?.tool_and_anchor || 'Everyday tool interaction'}
                      </p>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                        Acoustic Climax & Shock (8–10s)
                      </span>
                      <p className="text-slate-200 mt-1 leading-relaxed">
                        {videoAnalysisResult.originalAnalysis?.climax || 'Violent fracture & stumble cut'}
                      </p>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                        Foley Sound Design
                      </span>
                      <p className="text-slate-200 mt-1 leading-relaxed font-mono text-[11px]">
                        {videoAnalysisResult.originalAnalysis?.audio_elements || 'Natural terrain Foley and panicked breathing'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2: Re-Skinned Original Concept */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        New Re-Skinned Concept
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {videoAnalysisResult.reSkinnedConcept?.title || 'Original Anomaly Series'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                        Core Impossible Anomaly
                      </span>
                      <p className="text-purple-300 font-semibold mt-1 leading-relaxed">
                        {videoAnalysisResult.reSkinnedConcept?.core_hook || 'Original impossible physical phenomenon'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                          New Biome
                        </span>
                        <p className="text-slate-200 mt-1 leading-relaxed">
                          {videoAnalysisResult.reSkinnedConcept?.new_biome || 'Geological environment'}
                        </p>
                      </div>

                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                          Everyday Tool & Probe
                        </span>
                        <p className="text-slate-200 mt-1 leading-relaxed">
                          {videoAnalysisResult.reSkinnedConcept?.new_tool || 'Authentic tool'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                          Micro Scale Anchor
                        </span>
                        <p className="text-slate-200 mt-1 leading-relaxed">
                          {videoAnalysisResult.reSkinnedConcept?.new_scale_anchor || 'Organic biological scale marker'}
                        </p>
                      </div>

                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70">
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">
                          Concussive Climax
                        </span>
                        <p className="text-slate-200 mt-1 leading-relaxed">
                          {videoAnalysisResult.reSkinnedConcept?.new_climax || 'Acoustic shock fracture'}
                        </p>
                      </div>
                    </div>

                    {/* Master Prompt Snippet */}
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/70 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold text-[11px] uppercase">
                          Synthesized Master Prompt
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (videoAnalysisResult.masterPrompt) {
                              await navigator.clipboard.writeText(videoAnalysisResult.masterPrompt);
                              setCopiedMasterPrompt(true);
                              setTimeout(() => setCopiedMasterPrompt(false), 2000);
                            }
                          }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                        >
                          {copiedMasterPrompt ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Prompt</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed font-mono line-clamp-4 bg-slate-950 p-2 rounded-lg border border-slate-900">
                        {videoAnalysisResult.masterPrompt}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Test Prompts Inspection Panel */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Test Batch Verification ({videoAnalysisResult.testPrompts?.length || 0} Prompts Generated)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Inspect each prompt individually. Check tone, camera instructions and Foley sound details.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTestPrompts}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .txt</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyAllTestPrompts}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                    >
                      {copiedAllTest ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied All!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy All</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSendTestBatchToVps}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-600/40 transition-colors"
                    >
                      <Server className="w-3.5 h-3.5" />
                      <span>Test on VPS</span>
                    </button>
                  </div>
                </div>

                {/* Test Prompts Cards List */}
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                  {videoAnalysisResult.testPrompts?.map(item => (
                    <div
                      key={item.index}
                      className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-xs transition-all hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-bold rounded-md font-mono text-[11px] border border-blue-500/30">
                            TEST SAMPLE #{item.index}
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            {item.sub_genre || item.location}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyTestPrompt(item.text, item.index)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                        >
                          {copiedTestIdx === item.index ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-slate-300 leading-relaxed font-mono text-[11px] whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/70">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Final 1-Click Expansion Callout */}
                <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Verified this concept? Ready to scale directly into your VPS Auto Bulk Video Generator pipeline.
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveAndExpand(500)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Approve & Expand to 500 Prompts</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 📝 TAB 2: DIRECT MASTER PROMPT GENERATOR (QWEN 3.8 ULTRA)      */}
      {/* ============================================================== */}
      {mainMode === 'master_prompt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Master Prompt Input & Controls */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Master Prompt
                </label>
                <button
                  type="button"
                  onClick={handleUseSamplePrompt}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center gap-1"
                >
                  Load Example
                </button>
              </div>

              <textarea
                value={masterPrompt}
                onChange={e => setMasterPrompt(e.target.value)}
                placeholder="Paste your Master Prompt here..."
                rows={8}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono leading-relaxed"
              />

              {/* Target & Batch Selection */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                    Target Prompts
                  </label>
                  <select
                    value={targetCount}
                    onChange={e => setTargetCount(Number(e.target.value))}
                    disabled={isGenerating}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value={50}>50 Prompts</option>
                    <option value={100}>100 Prompts</option>
                    <option value={200}>200 Prompts</option>
                    <option value={300}>300 Prompts</option>
                    <option value={500}>500 Prompts</option>
                    <option value={750}>750 Prompts</option>
                    <option value={1000}>1,000 Prompts</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                    Batch Size
                  </label>
                  <select
                    value={batchSize}
                    onChange={e => setBatchSize(Number(e.target.value))}
                    disabled={isGenerating}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value={3}>3 prompts / batch</option>
                    <option value={5}>5 prompts / batch (Recommended)</option>
                    <option value={10}>10 prompts / batch</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons With Active Rotating Sign */}
              <div className="flex items-center gap-3 pt-2">
                {!isGenerating ? (
                  <button
                    type="button"
                    onClick={handleStartGeneration}
                    disabled={isAnalyzing}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Analyzing Blueprint...</span>
                      </>
                    ) : isPaused ? (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>Resume Generation</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate {targetCount} Prompts</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all"
                  >
                    <Pause className="w-4 h-4 fill-white" />
                    <span>Pause Generation</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset all"
                  disabled={isGenerating}
                  className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors disabled:opacity-40"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Prompt Blueprint & Variation Elements Card */}
            {matrix && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Prompt Structure
                    </span>
                  </div>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {matrix.niche_name}
                  </span>
                </div>

                <div className="flex gap-2 border-b border-slate-800/80 pb-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('blueprint')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      activeTab === 'blueprint'
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Prompt Blueprint
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('elements')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      activeTab === 'elements'
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Variation Elements
                  </button>
                </div>

                {activeTab === 'blueprint' && (
                  <div className="space-y-2.5 text-xs">
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">
                        Camera Setup
                      </span>
                      <p className="text-slate-200 text-xs mt-1 leading-relaxed font-mono">
                        {matrix.fixed_dna?.camera_and_medium || '9:16 vertical smartphone rear POV'}
                      </p>
                    </div>

                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">
                        Timeline Breakdown
                      </span>
                      <ul className="mt-1 space-y-1 text-slate-300 text-[11px] list-disc list-inside">
                        {matrix.fixed_dna?.timing_breakdown?.map((b, i) => (
                          <li key={i}>{b}</li>
                        )) || (
                          <>
                            <li>0–2s: Visual hook & anomaly introduction</li>
                            <li>0–3s: Handheld approach with terrain footsteps</li>
                            <li>3–6s: Physical test with scale anchor</li>
                            <li>6–8s: Secondary reaction & escalation</li>
                            <li>8–10s: Concussive climax & cut</li>
                          </>
                        )}
                      </ul>
                    </div>

                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/70">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">
                        Negative Prompt
                      </span>
                      <p className="text-slate-400 text-[11px] mt-1 line-clamp-2 italic font-mono">
                        {matrix.fixed_dna?.negative_prompt || 'Standard quality rules'}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'elements' && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-500 text-[11px] block">Sub-Genres</span>
                        <span className="font-bold text-slate-200">
                          {matrix.hierarchical_matrix?.sub_genres?.length || 25} biomes
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-500 text-[11px] block">Locations</span>
                        <span className="font-bold text-slate-200">
                          {matrix.hierarchical_matrix?.locations?.length || 35} environments
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-500 text-[11px] block">Subjects</span>
                        <span className="font-bold text-slate-200">
                          {matrix.hierarchical_matrix?.subjects_or_anomalies?.length || 35} subjects
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-500 text-[11px] block">Test Tools</span>
                        <span className="font-bold text-slate-200">
                          {matrix.hierarchical_matrix?.tools_and_probes?.length || 25} probes
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-500 text-[11px] block">Scale Anchors</span>
                        <span className="font-bold text-slate-200">
                          {matrix.hierarchical_matrix?.scale_anchors?.length || 20} anchors
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-500 text-[11px] block">Climaxes</span>
                        <span className="font-bold text-slate-200">
                          {matrix.hierarchical_matrix?.climaxes?.length || 25} endings
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Live Progress & Formatted Output */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Generation Progress Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col space-y-3 relative overflow-hidden">
              {isGenerating && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse" />
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-white">Generation Progress</span>
                  {isGenerating && (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating in background...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isGenerating && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  )}
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {prompts.length} / {targetCount} ({progressPercent}%)
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 relative">
                <div
                  className={`bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 h-full transition-all duration-300 rounded-full ${
                    isGenerating ? 'animate-pulse' : ''
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Current Active Item Ticker */}
              {currentPrompt && (
                <div className="text-xs text-slate-400 flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80">
                  <span className="truncate pr-2">
                    <strong className="text-slate-200">Latest #{currentPrompt.index}:</strong> {currentPrompt.location}
                  </span>
                  <span className="text-emerald-400 font-bold shrink-0 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Saved
                  </span>
                </div>
              )}

              {/* Action Bar: Download, Copy, Send to VPS */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  disabled={prompts.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .txt</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAll}
                  disabled={prompts.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-40"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowVpsModal(true)}
                  disabled={prompts.length === 0}
                  className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Send to VPS</span>
                </button>
              </div>
            </div>

            {/* Formatted Output Preview */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-[460px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Formatted Output ({prompts.length} Ready)
                  </span>
                  {isGenerating && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  )}
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-2">
                  <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode('txt')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        viewMode === 'txt'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Raw TXT
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        viewMode === 'cards'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Scene Cards
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === 'txt' ? (
                <div
                  ref={outputBoxRef}
                  className="flex-1 bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-y-auto max-h-[520px] border border-slate-800 custom-scrollbar leading-relaxed whitespace-pre-wrap select-text"
                >
                  {prompts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 py-20 space-y-3">
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                          <p className="text-blue-400 font-semibold text-sm">
                            Generating prompts in background...
                          </p>
                          <p className="text-slate-500 text-xs">
                            Prompts will appear here in real-time.
                          </p>
                        </>
                      ) : (
                        <>
                          <Film className="w-8 h-8 opacity-40" />
                          <p>No prompts generated yet. Enter a Master Prompt or use Video Reverse-Engineer.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {formatPromptsText(prompts)}
                      {isGenerating && (
                        <div className="flex items-center gap-2 py-3 text-blue-400 text-xs animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating next batch in background...</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex-1 bg-slate-950 rounded-xl p-3 overflow-y-auto max-h-[520px] border border-slate-800 custom-scrollbar space-y-3">
                  {prompts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 py-20 space-y-3">
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                          <p className="text-blue-400 font-semibold text-sm">
                            Generating scenes in background...
                          </p>
                        </>
                      ) : (
                        <>
                          <Film className="w-8 h-8 opacity-40" />
                          <p>No prompt cards generated yet.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {prompts.map(p => (
                        <div
                          key={p.index}
                          className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-bold rounded-md font-mono text-[11px] border border-blue-500/30">
                                PROMPT {p.index}
                              </span>
                              <span className="text-xs text-slate-300 font-semibold truncate max-w-[280px]">
                                {p.sub_genre || p.location}
                              </span>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Saved
                            </span>
                          </div>
                          <p className="text-slate-300 leading-relaxed font-mono text-[11px] whitespace-pre-wrap bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/60">
                            {p.text}
                          </p>
                        </div>
                      ))}
                      {isGenerating && (
                        <div className="flex items-center justify-center gap-2 py-3 text-blue-400 text-xs animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating next scenes...</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 🚀 VPS TRANSFER MODAL                                          */}
      {/* ============================================================== */}
      {showVpsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Server className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Send to VPS
                  </h3>
                  <p className="text-xs text-slate-400">
                    Transfer prompt file to Auto Bulk Video Generator
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVpsModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  VPS Bot Webhook URL (Optional)
                </label>
                <input
                  type="text"
                  value={vpsUrl}
                  onChange={e => setVpsUrl(e.target.value)}
                  placeholder="http://158.180.26.131:8000/api/upload-prompts"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Target directory: <code className="text-slate-400">/home/ubuntu/Auto_Bulk_Video_Generator/prompts/master/</code>
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <p><strong>Total Prompts:</strong> {prompts.length}</p>
                <p><strong>Series Title:</strong> {matrix?.niche_name || 'Video Series'}</p>
                <p><strong>Format:</strong> Structured TXT (.txt)</p>
              </div>

              {vpsSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{vpsSuccessMsg}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowVpsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSendToVps}
                disabled={isSendingToVps}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                {isSendingToVps ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transferring to VPS...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Deploy to VPS Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
