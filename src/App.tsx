import { useState } from 'react';
import { ImportPanel } from './components/ImportPanel';
import { WorkRecordList } from './components/WorkRecordList';
import { ExportPanel } from './components/ExportPanel';
import { SettingsPanel } from './components/SettingsPanel';

type Tab = 'import' | 'browse' | 'export' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('import');

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
        {activeTab === 'import' && <ImportPanel />}
        {activeTab === 'browse' && <WorkRecordList />}
        {activeTab === 'export' && <ExportPanel />}
        {activeTab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
}

export default App;
