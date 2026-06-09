import { useState, useEffect } from 'react';
import { ImportPanel } from './components/ImportPanel';
import { WorkRecordList } from './components/WorkRecordList';
import { ExportPanel } from './components/ExportPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { isTauri } from '@tauri-apps/api/core';

type Tab = 'import' | 'browse' | 'export' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('import');
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  useEffect(() => {
    setIsTauriEnv(isTauri());
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('import')}
              className={`py-4 px-2 border-b-2 ${
                activeTab === 'import'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              导入
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              className={`py-4 px-2 border-b-2 ${
                activeTab === 'browse'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              数据浏览
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`py-4 px-2 border-b-2 ${
                activeTab === 'export'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              月度导出
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-2 border-b-2 ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              设置
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!isTauriEnv && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="text-yellow-800 font-semibold mb-2">⚠️ 警告</h3>
            <p className="text-yellow-700 text-sm">
              此应用需要在 Tauri 桌面应用中运行才能正常工作。网页端无法使用数据库功能（数据浏览、删除、月度导出等）。
              请使用 `npm run tauri dev` 启动桌面应用。
            </p>
          </div>
        )}
        {activeTab === 'import' && <ImportPanel />}
        {activeTab === 'browse' && <WorkRecordList />}
        {activeTab === 'export' && <ExportPanel />}
        {activeTab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
}

export default App;
