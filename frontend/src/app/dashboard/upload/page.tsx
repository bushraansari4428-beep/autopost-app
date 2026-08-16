'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CloudUploadPage() {
  const router = useRouter();
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data);
        if (data.length > 0) setSelectedPageId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch pages', e);
    }
  };

  const handleDrag = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.includes('video/mp4') || droppedFile.name.endsWith('.mp4')) {
        setFile(droppedFile);
        setMessage({ type: '', text: '' });
      } else {
        setMessage({ type: 'error', text: 'Only MP4 video files are supported.' });
      }
    }
  };

  const handleFileChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage({ type: '', text: '' });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a video file to upload.' });
      return;
    }
    if (!selectedPageId) {
      setMessage({ type: 'error', text: 'Please select a Facebook Page.' });
      return;
    }

    setIsUploading(true);
    setMessage({ type: '', text: '' });
    const token = localStorage.getItem('token');
    
    const formData = new FormData();
    formData.append('video', file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pages/${selectedPageId}/cloud-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Video uploaded to Cloud successfully! It will be posted at your scheduled time.' });
        setFile(null);
        // Reset file input UI
        const fileInput = document.getElementById('video-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setMessage({ type: 'error', text: data.message || 'Upload failed.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: 'An unexpected error occurred during upload.' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Cloud Video Uploader</h1>
          <p className="text-gray-400">
            Upload videos directly to the Cloud (Mega.nz). Your laptop can be turned off, and the system will automatically download and post them at your scheduled time. Videos are automatically deleted after posting to free up space!
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-xl">
        {/* Page Selection */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-300 mb-2">Select Facebook Page</label>
          <select
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          >
            {pages.length === 0 && <option value="">No Pages Connected</option>}
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            The video will be added to this page's cloud queue and posted based on its scheduled time in the Mappings tab.
          </p>
        </div>

        {/* Drag and Drop Zone */}
        <div 
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
            dragActive ? 'border-blue-500 bg-blue-500/10' : 
            file ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700 hover:border-gray-600 bg-gray-950'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="video-upload"
            accept="video/mp4"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          
          <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
            {file ? (
              <>
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{file.name}</p>
                  <p className="text-sm text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <p className="text-xs text-gray-500">Click or drag a different file to replace</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-gray-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">Drag & drop your MP4 video here</p>
                  <p className="text-sm text-gray-400">or click to browse from your computer</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Message Alert */}
        {message.text && (
          <div className={`mt-6 p-4 rounded-xl border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <div className="flex items-start">
              {message.type === 'success' ? (
                <svg className="w-5 h-5 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              )}
              <p className="font-medium">{message.text}</p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-8">
          <button
            onClick={handleUpload}
            disabled={!file || !selectedPageId || isUploading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 flex justify-center items-center ${
              !file || !selectedPageId || isUploading
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading to Cloud... Please wait
              </>
            ) : (
              'Upload & Schedule Video'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
