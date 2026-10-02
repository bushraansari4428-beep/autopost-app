export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
        <h1 className="text-3xl font-extrabold text-white mb-6">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-8">Last Updated: October 2026</p>
        
        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Overview</h2>
            <p>
              AutoPost App provides automated social media video synchronization and publishing services for Facebook Pages. We respect your privacy and are committed to protecting your personal and page data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Information We Access</h2>
            <p>
              When you authorize AutoPost App using Facebook OAuth, we receive access tokens and permissions to manage your selected Facebook Pages, read page metadata, and publish scheduled videos on your behalf. We do not access private personal messages or personal browsing data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. How Information is Used</h2>
            <p>
              Page access tokens and video URLs are exclusively used to execute your configured publishing schedules and display performance analytics within your personal AutoPost dashboard. We never sell, rent, or distribute your data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Data Storage and Security</h2>
            <p>
              All access credentials and scheduling information are stored in secure, encrypted cloud databases with restricted access protocols.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. User Data Deletion Instructions</h2>
            <p>
              You can disconnect any Facebook Page directly from your AutoPost App dashboard at any time, which permanently purges the page token from our active systems. To request complete removal of all your account data, please contact us at support@autopost-app.com or submit a deletion request via our data deletion endpoint.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
