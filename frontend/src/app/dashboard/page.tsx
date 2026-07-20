export default function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl shadow-black/50">
          <p className="text-gray-400 text-sm font-medium">Total Sources</p>
          <p className="text-4xl font-bold text-white mt-2">0</p>
        </div>
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl shadow-black/50">
          <p className="text-gray-400 text-sm font-medium">Connected FB Pages</p>
          <p className="text-4xl font-bold text-blue-400 mt-2">0</p>
        </div>
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl shadow-black/50">
          <p className="text-gray-400 text-sm font-medium">Successful Uploads</p>
          <p className="text-4xl font-bold text-green-400 mt-2">0</p>
        </div>
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl shadow-black/50">
          <p className="text-gray-400 text-sm font-medium">Failed Uploads</p>
          <p className="text-4xl font-bold text-red-400 mt-2">0</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Uploads</h2>
          <div className="text-center py-10 text-gray-500">
            No uploads yet.
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Queue Status</h2>
          <div className="text-center py-10 text-gray-500">
            Queue is empty.
          </div>
        </div>
      </div>
    </div>
  );
}
