export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
        <h1 className="text-3xl font-extrabold text-white mb-6">User Data Deletion Callback & Instructions</h1>
        <p className="text-sm text-slate-400 mb-8">AutoPost App Platform Data Deletion Policy</p>
        
        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <p>
            In accordance with Facebook Platform Rules, AutoPost App provides a straightforward mechanism for users to delete their account data and revoked Facebook Page tokens.
          </p>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">Step-by-Step Instructions:</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Log in to your AutoPost App account and navigate to <strong>Facebook Pages</strong>.</li>
              <li>Click <strong>Disconnect</strong> next to any Page you wish to unlink. All associated tokens and automated mapping tasks are deleted immediately.</li>
              <li>To revoke app permissions from Facebook directly, go to your Facebook Account <strong>Settings & Privacy &gt; Settings &gt; Apps and Websites</strong>, find <strong>AutoPost App</strong> (or App ID 911473734693149), and click <strong>Remove</strong>.</li>
              <li>To request complete purge of historical upload logs, email <strong>support@autopost-app.com</strong> with your registered email ID.</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
