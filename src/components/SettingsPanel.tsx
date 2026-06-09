import { useEffect, useState } from 'react';
import { useAppStore, Settings } from '../store/useAppStore';
import { ConfirmDialog } from './ConfirmDialog';

export function SettingsPanel() {
  const { settings, loadSettings, saveSettings, clearAllData } = useAppStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = (key: keyof Settings, value: string | number) => {
    saveSettings({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">设置</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">API 配置</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Claude API Key
              </label>
              <input
                type="password"
                value={settings.api_key}
                onChange={(e) => handleSave('api_key', e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="sk-..."
              />
              <p className="text-xs text-gray-500 mt-1">
                API Key 将安全存储在本地 SQLite 数据库中
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">工时计算配置</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                默认出勤天数
              </label>
              <input
                type="number"
                value={settings.default_attendance_days}
                onChange={(e) => handleSave('default_attendance_days', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded"
                min="1"
                max="31"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">数据管理</h2>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            清除所有数据
          </button>
          <p className="text-xs text-gray-500 mt-2">
            此操作将删除所有工时记录、标签映射和导出配置，但保留 API Key 和计算配置
          </p>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="清除所有数据"
        message="确定要清除所有数据吗？此操作将删除所有工时记录、标签映射和导出配置，且不可恢复。"
        confirmLabel="确认清除"
        confirmVariant="danger"
        onConfirm={async () => {
          try {
            await clearAllData();
          } catch (e) {
            console.error('清除所有数据失败:', e);
          }
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
