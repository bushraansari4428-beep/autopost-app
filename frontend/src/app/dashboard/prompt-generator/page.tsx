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
  Eye,
  Check,
  Loader2,
  Terminal
} from 'lucide-react';

interface PromptMatrix {
  niche_name: string;
  theme_summary: string;
  subjects: string[];
  locations: string[];
  actions_or_hooks: string[];
  camera_styles: string[];
}

interface PromptItem {
  index: number;
  location: string;
  subject: string;
  text: string;
}

export default function PromptGeneratorPage() {
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [targetCount, setTargetCount] = useState<number>(1000);
  const [batchSize, setBatchSize] = useState<number>(5);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [matrix, setMatrix] = useState<PromptMatrix | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<PromptItem | null>(null);

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // VPS Modal state
  const [showVpsModal, setShowVpsModal] = useState<boolean>(false);
  const [vpsUrl, setVpsUrl] = useState<string>('');
  const [isSendingToVps, setIsSendingToVps] = useState<boolean>(false);
  const [vpsSuccessMsg, setVpsSuccessMsg] = useState<string>('');

  const stopSignalRef = useRef<boolean>(false);
  const outputBoxRef = useRef<HTMLDivElement>(null);

  // Load saved master prompt and VPS URL from localStorage
  useEffect(() => {
    const savedPrompt = localStorage.getItem('last_master_prompt');
    if (savedPrompt) setMasterPrompt(savedPrompt);
    const savedVps = localStorage.getItem('vps_video_generator_url');
    if (savedVps) setVpsUrl(savedVps);
  }, []);

  const handleUseSamplePrompt = () => {
    const sample = `A high-quality 10-second viral wildlife encounter video.
A tiny miniature creature encounters a massive gentle giant animal in a remote natural landscape.
Camera is locked-off 25 meters away documentary style.
The tiny animal approaches peacefully and shares an adorable, trusting bonding moment (cuddle, sneeze, sharing food, or grooming).
High contrast dynamic lighting, ultra-realistic nature documentary, cinematic 4K.`;
    setMasterPrompt(sample);
  };

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  // Format prompts into exact requested string: PROMPT 1 \n\n text \n\n PROMPT 2 \n\n text ...
  const formatPromptsText = (items: PromptItem[]): string => {
    return items
      .map(p => `PROMPT ${p.index}\n\n\n${p.text}\n\n\n`)
      .join('');
  };

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

    // Step 1: Deep Analysis if not already analyzed
    if (!activeMatrix) {
      setIsAnalyzing(true);
      setStatusMessage('🧠 Analyzing Master Prompt DNA & extracting niche matrix via Qwen 3.8...');
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

    // Step 2: Sequential Batch Generation Loop
    setIsGenerating(true);
    setStatusMessage('🚀 Generating unique prompts at ultra-fast neural speed...');

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

        const data = await res.json();
        if (data.success && Array.isArray(data.prompts)) {
          accumulated = [...accumulated, ...data.prompts];
          setPrompts([...accumulated]);
          if (data.prompts.length > 0) {
            setCurrentPrompt(data.prompts[data.prompts.length - 1]);
          }
          currentIdx += data.prompts.length;

          // Auto-scroll output box
          if (outputBoxRef.current) {
            outputBoxRef.current.scrollTop = outputBoxRef.current.scrollHeight;
          }
        } else {
          // Micro delay and retry on minor hiccup
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err: any) {
        console.error('Batch error:', err);
        await new Promise(r => setTimeout(r, 2000));
      }

      // Small tick between batches
      await new Promise(r => setTimeout(r, 100));
    }

    setIsGenerating(false);
    if (currentIdx > targetCount) {
      setStatusMessage(`🎉 Completed! All ${targetCount} prompts generated successfully!`);
    } else if (stopSignalRef.current) {
      setIsPaused(true);
      setStatusMessage(`⏸️ Paused at Prompt ${accumulated.length}. You can resume anytime.`);
    }
  };

  const handlePause = () => {
    stopSignalRef.current = true;
    setIsGenerating(false);
    setIsPaused(true);
    setStatusMessage(`⏸️ Paused. Generated ${prompts.length} of ${targetCount} prompts.`);
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
    const cleanNiche = (matrix?.niche_name || 'Viral_Content')
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

    const cleanNiche = (matrix?.niche_name || 'Niche')
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
        setVpsSuccessMsg(data.message || 'Prompt file successfully transferred to VPS Auto Bulk Video Generator!');
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
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/25 border border-purple-500/30">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  1,000 AI Prompt Generator
                </h1>
                <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700/80">
                  Backup by Qwen 3.8 Ultra
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Transfer 1 master prompt into 1000 prompts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Inputs & Output */}
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
              rows={7}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono"
            />

            {/* Target Options */}
            <div className="pt-1">
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                Target Prompts
              </label>
              <select
                value={targetCount}
                onChange={e => setTargetCount(Number(e.target.value))}
                disabled={isGenerating}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value={50}>50 Prompts</option>
                <option value={100}>100 Prompts</option>
                <option value={200}>200 Prompts</option>
                <option value={300}>300 Prompts</option>
                <option value={400}>400 Prompts</option>
                <option value={500}>500 Prompts</option>
                <option value={600}>600 Prompts</option>
                <option value={700}>700 Prompts</option>
                <option value={800}>800 Prompts</option>
                <option value={900}>900 Prompts</option>
                <option value={1000}>1,000 Prompts</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              {!isGenerating ? (
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  disabled={isAnalyzing}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing DNA...
                    </>
                  ) : isPaused ? (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      Resume Generation
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate {targetCount} Prompts
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
                  Pause Generation
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

            {/* Error or Status message */}
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {statusMessage && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-400 flex items-center gap-2">
                <Zap className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>

          {/* DNA Matrix Card (Shows once analyzed) */}
          {matrix && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-indigo-400" />
                  Analyzed DNA Matrix
                </h3>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {matrix.niche_name}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                "{matrix.theme_summary}"
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block">Locations:</span>
                  <span className="font-bold text-slate-300">{matrix.locations?.length || 0} unique environments</span>
                </div>
                <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block">Subjects:</span>
                  <span className="font-bold text-slate-300">{matrix.subjects?.length || 0} distinct characters</span>
                </div>
                <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block">Hooks & Climax:</span>
                  <span className="font-bold text-slate-300">{matrix.actions_or_hooks?.length || 0} viral variations</span>
                </div>
                <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block">Camera Styles:</span>
                  <span className="font-bold text-slate-300">{matrix.camera_styles?.length || 0} angles</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Progress & Formatted Output */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {/* Progress Header */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-white">Generation Progress</span>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400">
                {prompts.length} / {targetCount} ({progressPercent}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Current Active Item Ticker */}
            {currentPrompt && (
              <div className="text-xs text-slate-400 flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80">
                <span className="truncate pr-2">
                  <strong className="text-slate-200">Latest #{currentPrompt.index}:</strong> {currentPrompt.location}
                </span>
                <span className="text-emerald-400 font-bold shrink-0">Saved</span>
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
                <span>Send to VPS (Auto Bulk Video Generator)</span>
              </button>
            </div>
          </div>

          {/* Formatted Output Preview (Exact Requested Structure) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                Live Formatted Output
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Format: PROMPT X [2 spaces] Text
              </span>
            </div>

            <div
              ref={outputBoxRef}
              className="flex-1 bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-y-auto max-h-[500px] border border-slate-800 custom-scrollbar leading-relaxed whitespace-pre-wrap select-text"
            >
              {prompts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 py-16 space-y-2">
                  <Film className="w-8 h-8 opacity-40" />
                  <p>No prompts generated yet. Enter a Master Prompt and click Start.</p>
                </div>
              ) : (
                formatPromptsText(prompts)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 One-Click VPS Transfer Modal */}
      {showVpsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Server className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Send to VPS Auto Bulk Video Generator</h3>
                  <p className="text-xs text-slate-400">1-Click deploy your prompt file to your rendering bot</p>
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
                  VPS Server Webhook / Agent URL (Optional)
                </label>
                <input
                  type="text"
                  value={vpsUrl}
                  onChange={e => setVpsUrl(e.target.value)}
                  placeholder="http://<your-vps-ip>:8000/api/upload-prompts"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  If left blank, file is automatically stored in server storage (<code className="text-slate-400">uploads/prompts</code>) and available for immediate bot sync.
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <p><strong>Total Prompts:</strong> {prompts.length} unique scenes</p>
                <p><strong>Niche:</strong> {matrix?.niche_name || 'Viral Content'}</p>
                <p><strong>Format:</strong> Structured TXT for Auto Bulk Video Generator</p>
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
                    <span>Transfer File Now</span>
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
