export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
        <h1 className="text-3xl font-extrabold text-white mb-6">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-8">Last Updated: October 2026</p>
        
        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Terms of Use</h2>
            <p>
              By accessing and using AutoPost App, you agree to comply with all applicable terms, Facebook Platform policies, and content guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Service Usage</h2>
            <p>
              AutoPost App provides automated publishing assistance for authorized social media pages owned or managed by you. You are responsible for ensuring that all published video content complies with community standards and copyright laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Disclaimers and Limitations</h2>
            <p>
              The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
