'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CloudUploadPage() {
  const router = useRouter();
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
        if (data.length > 0 && !selectedPageId) setSelectedPageId(data[0].id);
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      const validFiles = droppedFiles.filter(f => f.type.includes('video/mp4') || f.name.endsWith('.mp4'));
      if (validFiles.length > 0) {
        setFiles(prev => [...prev, ...validFiles]);
        setMessage({ type: '', text: '' });
      } else {
        setMessage({ type: 'error', text: 'Only MP4 video files are supported.' });
      }
    }
  };

  const handleFileChange = (e: any) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files) as File[];
      const validFiles = selectedFiles.filter(f => f.type.includes('video/mp4') || f.name.endsWith('.mp4'));
      if (validFiles.length > 0) {
        setFiles(prev => [...prev, ...validFiles]);
        setMessage({ type: '', text: '' });
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteQueue = async () => {
    if (!selectedPageId) return;
    if (!confirm('Are you sure you want to delete all pending videos from Mega Cloud for this page? This cannot be undone.')) return;
    
    setIsDeleting(true);
    setMessage({ type: '', text: '' });
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pages/${selectedPageId}/cloud-queue`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Videos deleted successfully.' });
        fetchPages();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete videos.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Network error occurred while deleting videos.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Please select video files to upload.' });
      return;
    }
    if (!selectedPageId) {
      setMessage({ type: 'error', text: 'Please select a Facebook Page.' });
      return;
    }

    setIsUploading(true);
    setMessage({ type: '', text: '' });
    const token = localStorage.getItem('token');
    
    let successCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(i + 1);
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

        if (res.ok) {
          successCount++;
        }
      } catch (e: any) {
        console.error('Upload failed for', file.name, e);
      }
    }

    if (successCount === files.length) {
      setMessage({ type: 'success', text: `Successfully uploaded ${successCount} video(s) to Cloud! They will be posted at your scheduled time.` });
      setFiles([]);
    } else if (successCount > 0) {
      setMessage({ type: 'success', text: `Uploaded ${successCount} out of ${files.length} videos successfully.` });
      setFiles(files.slice(successCount));
    } else {
      setMessage({ type: 'error', text: 'Upload failed for all videos.' });
    }
    
    setUploadProgress(0);
    setIsUploading(false);
    const fileInput = document.getElementById('video-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
    // Refresh page data to update the cloud queue count
    fetchPages();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Cloud Video Uploader</h1>
          <div className="text-gray-400 text-sm leading-relaxed mt-2">
            <p>Upload your local videos to the Cloud so our system can post them for you even when your PC is offline. Videos are automatically deleted after posting to free up space!</p>
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <span className="font-semibold text-blue-400">Important:</span> To use this feature, you must first create a free account at <a href="https://mega.nz" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Mega.nz</a>, then enter your Mega credentials in your <strong><a href="/dashboard/profile" className="text-blue-400 hover:underline">My Cloud Profile</a></strong> tab.
            </div>
          </div>
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
          
          {selectedPageId && (
            <div className="mt-3 flex items-center space-x-3">
              <div className="inline-flex items-center space-x-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
                </svg>
                <span className="text-sm font-semibold">
                  {pages.find(p => p.id === selectedPageId)?.cloudQueueCount || 0} video(s) remaining in cloud queue
                </span>
              </div>
              
              <button 
                onClick={handleDeleteQueue}
                disabled={isDeleting || (pages.find(p => p.id === selectedPageId)?.cloudQueueCount || 0) === 0}
                className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>{isDeleting ? 'Deleting...' : 'Delete Videos'}</span>
              </button>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500">
            The video will be added to this page's cloud queue and posted based on its scheduled time in the Mappings tab.
          </p>
        </div>

        {/* Drag and Drop Zone */}
        <div 
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
            dragActive ? 'border-blue-500 bg-blue-500/10' : 
            files.length > 0 ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700 hover:border-gray-600 bg-gray-950'
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
            multiple
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          
          <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
            {files.length > 0 ? (
              <div className="w-full max-h-60 overflow-y-auto z-10 relative space-y-2 pointer-events-auto">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-lg font-semibold text-white">{files.length} video(s) selected</p>
                  <p className="text-xs text-gray-500">Add more by dragging or clicking</p>
                </div>
                {files.map((f, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-900/80 p-3 rounded-xl border border-gray-700">
                    <div className="flex items-center space-x-3 truncate">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-semibold text-white truncate">{f.name}</p>
                        <p className="text-xs text-gray-400">{(f.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(i); }} disabled={isUploading} className="text-red-400 hover:text-red-300 p-2 shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                ))}
              </div>
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
            disabled={files.length === 0 || !selectedPageId || isUploading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 flex justify-center items-center ${
              files.length === 0 || !selectedPageId || isUploading
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
                Uploading {uploadProgress} of {files.length}... Please wait
              </>
            ) : (
              'Upload & Schedule Video' + (files.length > 1 ? 's' : '')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
