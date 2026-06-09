import { useState, useCallback } from 'react';
import { useAppStore, WorkRecord } from '../store/useAppStore';
import { parseLakeFile, parseXlsxFile, hoursToNumber } from '../utils/lakeParser';

export function ImportPanel() {
  const [previewRecords, setPreviewRecords] = useState<WorkRecord[]>([]);
  const [useAI, setUseAI] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { importLakeFile, addRecords, settings } = useAppStore();

  const handleFile = useCallback(
    async (file: File) => {
      try {
        let parsed;
        if (file.name.endsWith('.xlsx')) {
          // 解析 xlsx 文件
          const content = await file.arrayBuffer();
          parsed = await parseXlsxFile(content);
        } else {
          // 解析 .lake 文件
          const content = await file.text();
          parsed = parseLakeFile(content);
        }

        const simpleRecords: WorkRecord[] = parsed.records.map((r, i) => ({
          id: `temp-${i}`,
          date: r.date,
          requirement_name: r.content_tags.join(', ') || '未分类',
          hours: hoursToNumber(r.hours),
          project: r.project,
          raw_tags: r.content_tags,
          is_manual: false,
          import_batch: '',
          created_at: new Date().toISOString(),
        }));
        setPreviewRecords(simpleRecords);
      } catch (e) {
        alert(`解析失败: ${e}`);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.lake') || file.name.endsWith('.xlsx'))) {
        handleFile(file);
      } else {
        alert('请上传 .lake 或 .xlsx 文件');
      }
    },
    [handleFile]
  );

  const handleImport = useCallback(async () => {
    if (previewRecords.length === 0) {
      alert('请先选择文件');
      return;
    }

    if (useAI && !settings.api_key) {
      alert('请先在设置页配置 API Key');
      return;
    }

    try {
      if (useAI) {
        // 通过后端调用 AI 处理
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput?.files?.[0]) {
          const content = await fileInput.files[0].text();
          const aiRecords = await importLakeFile(content, true);
          await addRecords(aiRecords);
          alert(`成功导入 ${aiRecords.length} 条记录`);
        }
      } else {
        await addRecords(previewRecords);
        alert(`成功导入 ${previewRecords.length} 条记录`);
      }
      setPreviewRecords([]);
    } catch (e) {
      alert(`导入失败: ${e}`);
    }
  }, [previewRecords, useAI, settings.api_key, importLakeFile, addRecords]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">导入工时数据</h1>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input
          type="file"
          accept=".lake,.xlsx"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
          id="file-input"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <p className="text-gray-600">
            拖拽 .lake 或 .xlsx 文件到此处，或点击选择文件
          </p>
        </label>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => setUseAI(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span>使用 AI 清洗数据（需要 API Key）</span>
        </label>
      </div>

      <button
        onClick={handleImport}
        disabled={previewRecords.length === 0}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        导入并预览
      </button>

      {previewRecords.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">预览区域</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">小时</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">标签</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">项目</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewRecords.slice(0, 10).map((record, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm">{record.date}</td>
                    <td className="px-4 py-2 text-sm">{record.hours}h</td>
                    <td className="px-4 py-2 text-sm">{record.requirement_name}</td>
                    <td className="px-4 py-2 text-sm">{record.project}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRecords.length > 10 && (
              <p className="px-4 py-2 text-sm text-gray-500">
                还有 {previewRecords.length - 10} 条记录...
              </p>
            )}
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              确认导入
            </button>
            <button
              onClick={() => setPreviewRecords([])}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
