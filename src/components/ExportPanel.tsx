import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { smartAllocate, aiAllocate, exportToExcel, Requirement, AllocationResult } from '../utils/allocation';

const INFRA_KEYWORDS = ['平台服务后台', '游戏运营平台', '会议'];
const EXCLUDED_TAGS = ['上线', '联调', '测试', '测试用例', '用例评审', '审批', '需求评审', '技术评审', '调整'];

function extractMainRequirementName(requirementName: string, tags: string[]): string {
  if (requirementName === '会议') {
    return '会议';
  }

  const cleanTags = tags.filter(t => !EXCLUDED_TAGS.includes(t));

  if (cleanTags.length > 0) {
    return cleanTags.join(' / ');
  }

  return requirementName;
}

function extractGame(requirementName: string): string {
  if (INFRA_KEYWORDS.some(kw => requirementName.includes(kw)) || requirementName === '会议') {
    return '基建公摊';
  }
  return '';
}

function determineLaborType(requirementName: string): string {
  if (INFRA_KEYWORDS.some(kw => requirementName.includes(kw)) || requirementName === '会议') {
    return '基建人力';
  }
  return '';
}

export function ExportPanel() {
  const { records, loadRecords, exportConfig, loadExportConfig, saveExportConfig, settings } = useAppStore();

  const [month, setMonth] = useState(() => {
    if (exportConfig.month) {
      return exportConfig.month;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendanceDays, setAttendanceDays] = useState(exportConfig.attendance_days || settings.default_attendance_days);
  const [useAI, setUseAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const hoursPerDay = 8;

  useEffect(() => {
    loadRecords();
    loadExportConfig();
  }, [loadRecords, loadExportConfig]);

  useEffect(() => {
    saveExportConfig({ month, attendance_days: attendanceDays });
  }, [month, attendanceDays, saveExportConfig]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => r.date.startsWith(month));
  }, [records, month]);

  const requirements = useMemo(() => {
    const map = new Map<string, Requirement>();

    filteredRecords.forEach((r) => {
      const tags = r.raw_tags || [];
      const mainName = extractMainRequirementName(r.requirement_name, tags);
      const project = r.project === '会议' ? '会议' : (r.project || '其他');

      if (mainName.trim()) {
        const existing = map.get(mainName);
        if (existing) {
          existing.hours += r.hours;
        } else {
          map.set(mainName, {
            name: mainName,
            hours: r.hours,
            project: project,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [filteredRecords]);

  // 全局分配结果
  const [allocationResults, setAllocationResults] = useState<AllocationResult[]>([]);

  useEffect(() => {
    if (requirements.length === 0) {
      setAllocationResults([]);
      return;
    }

    if (useAI && settings.api_key) {
      setAiLoading(true);
      aiAllocate(requirements, attendanceDays, settings.api_key, hoursPerDay)
        .then((aiResults) => {
          const enhanced = requirements.map((req) => {
            const aiMatch = aiResults.find((r) => r.name === req.name);
            return {
              name: req.name,
              actualHours: req.hours,
              manDays: aiMatch ? aiMatch.manDays : 0.5,
              project: req.project,
              game: extractGame(req.name),
              department: '',
              direction: '',
              laborType: determineLaborType(req.name),
            };
          });
          setAllocationResults(enhanced);
          setAiLoading(false);
        })
        .catch((e) => {
          console.error('AI 分配失败，回退到本地算法:', e);
          setUseAI(false);
          setAiLoading(false);
        });
    } else {
      const baseResults = smartAllocate(requirements, attendanceDays, hoursPerDay);
      const enhanced = baseResults.map((r) => ({
        ...r,
        game: extractGame(r.name),
        laborType: determineLaborType(r.name),
      }));
      setAllocationResults(enhanced);
    }
  }, [requirements, attendanceDays, useAI, settings.api_key]);

  const totals = useMemo(() => {
    return {
      hours: allocationResults.reduce((s, r) => s + r.actualHours, 0),
      manDays: allocationResults.reduce((s, r) => s + r.manDays, 0),
    };
  }, [allocationResults]);

  const diff = attendanceDays - totals.manDays;

  const handleExportExcel = () => {
    exportToExcel(allocationResults, month, attendanceDays, hoursPerDay);
  };

  const handleMonthChange = (value: string) => {
    setMonth(value);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">月度报表导出</h1>

      <div className="flex space-x-4 items-center flex-wrap gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="px-3 py-2 border rounded"
        />
        <span>出勤天数:</span>
        <input
          type="number"
          value={attendanceDays}
          onChange={(e) => setAttendanceDays(Number(e.target.value))}
          className="w-20 px-3 py-2 border rounded"
        />
        {settings.api_key && (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">AI 智能分配</span>
          </label>
        )}
        {aiLoading && <span className="text-sm text-blue-500">AI 分配中...</span>}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">需求名称</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">实际工时(h)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">对应游戏</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">工时（人日）</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">部门</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">所属方向</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">人力类型</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {allocationResults.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-sm">{r.name}</td>
                <td className="px-4 py-3 text-sm text-right">{r.actualHours}h</td>
                <td className="px-4 py-3 text-sm">{r.game || '-'}</td>
                <td className="px-4 py-3 text-sm text-right">{r.manDays.toFixed(1)}</td>
                <td className="px-4 py-3 text-sm">{r.department || '-'}</td>
                <td className="px-4 py-3 text-sm">{r.direction || '-'}</td>
                <td className="px-4 py-3 text-sm">{r.laborType || '-'}</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-semibold">
              <td className="px-4 py-3 text-sm">总计</td>
              <td className="px-4 py-3 text-sm text-right">{totals.hours}h</td>
              <td className="px-4 py-3 text-sm"></td>
              <td className="px-4 py-3 text-sm text-right">{totals.manDays.toFixed(1)}</td>
              <td className="px-4 py-3 text-sm"></td>
              <td className="px-4 py-3 text-sm"></td>
              <td className="px-4 py-3 text-sm"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-gray-600">
        人日差值: {diff.toFixed(1)} {Math.abs(diff) < 0.1 ? '（已校正）' : '（需调整出勤天数或需求分配）'}
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          导出企微 Excel
        </button>
        <button
          onClick={() => {
            const json = JSON.stringify(allocationResults, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${month}_工时统计.json`;
            a.click();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          导出 JSON
        </button>
      </div>
    </div>
  );
}
