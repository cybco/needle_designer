import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Title Bar */}
      <header className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">NeedlePoint Designer</h1>
        <span className="text-sm text-gray-400">v1.0.0</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Welcome to NeedlePoint Designer
          </h2>
          <p className="text-gray-600 mb-8">
            Create beautiful needlepoint and cross-stitch patterns
          </p>

          {/* Test button to verify React is working */}
          <button
            onClick={() => setCount(c => c + 1)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Click count: {count}
          </button>

          <div className="mt-8 text-sm text-gray-500">
            <p>Powered by Tauri + React + TypeScript</p>
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="bg-gray-200 px-4 py-1 text-sm text-gray-600 flex justify-between">
        <span>Ready</span>
        <span>No project loaded</span>
      </footer>
    </div>
  );
}

export default App;
