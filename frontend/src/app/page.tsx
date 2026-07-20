import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100 flex flex-col items-center">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/30 blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-pink-600/20 blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />

      <div className="z-10 container mx-auto px-6 py-20 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-blue-500/30 text-blue-400 mb-8 animate-float">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          <span className="text-sm font-medium tracking-wide uppercase">Next-Gen Automation</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
            Auto
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600">
            Cross-Posting
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mb-12 font-light leading-relaxed">
          The ultimate command center for your social media workflow. Automatically sync videos from any platform to your Facebook Pages.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6">
          <Link href="/dashboard" className="group relative px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 transition-all font-bold shadow-[0_0_40px_-10px_rgba(59,130,246,0.6)] flex items-center justify-center gap-3 overflow-hidden text-white">
            <span className="relative z-10 flex items-center gap-2">
              Launch Dashboard
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </span>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
          </Link>
          <Link href="/login" className="px-8 py-4 rounded-full glass hover:bg-white/10 transition-all font-semibold flex items-center justify-center border border-white/10 text-white">
            Sign In
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="mt-32 w-full grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6 text-blue-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Universal Sources</h3>
            <p className="text-slate-400 leading-relaxed">
              Seamlessly monitor YouTube, Instagram Reels, and TikTok profiles in real-time.
            </p>
          </div>
          
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 text-purple-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Instant Uploads</h3>
            <p className="text-slate-400 leading-relaxed">
              Our background workers utilize the official Facebook Graph API for robust, resumable uploads.
            </p>
          </div>
          
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-6 text-pink-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">Secure & Scalable</h3>
            <p className="text-slate-400 leading-relaxed">
              Enterprise-grade PostgreSQL and Redis infrastructure designed to handle thousands of concurrent pages.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

