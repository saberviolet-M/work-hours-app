import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { smartAllocate, aiAllocate, exportToExcel, Requirement, AllocationResult } from '../utils/allocation';
import { ConfirmDialog } from './ConfirmDialog';
import { DateRangePicker } from './DateRangePicker';

type DateRangeType = 'month' | 'lastMonth' | 'last3Months' | 'all';

interface DateRangeOption {
  type: DateRangeType;
  label: string;
}

const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { type: 'month', label: '本月' },
  { type: 'lastMonth', label: '上月' },
  { type: 'last3Months', label: '近3月' },
  { type: 'all', label: '全部' },
];

const EXCLUDED_TAGS = ['上线', '联调', '测试', '测试用例', '用例评审', '审批', '需求评审', '技术评审', '调整'];

// 项目名 → 需求名前缀
const PROJECT_PREFIX: Record<string, string> = {
  '平台服务后台': '【平台服务后台（游戏运营平台）】',
  '游戏活动平台': '【游戏活动】',
  '海外运营管理台': '【海外运营管理台】',
  '运营数据中心': '【运营数据中心】',
  'GameSDK': '【GameSDK】',
  '权限管理系统': '【权限管理系统】',
  '国内广告系统': '【国内广告系统】',
  '风控管理台': '【风控管理台】',
  '三谋管理后台': '【三谋管理后台】',
};

function formatDisplayName(name: string, project: string): string {
  if (name === '会议') return '会议';
  const prefix = PROJECT_PREFIX[project];
  if (prefix) {
    return `${prefix}${name}`;
  }
  return name;
}

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

export function ExportPanel() {
  const { records, loadRecords, exportConfig, loadExportConfig, saveExportConfig, settings } = useAppStore();

  const [month, setMonth] = useState(() => {
    if (exportConfig.month) {
      return exportConfig.month;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('month');
  const [attendanceDays, setAttendanceDays] = useState(exportConfig.attendance_days || settings.default_attendance_days);
  const [useAI, setUseAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  
  const hoursPerDay = 8;

  const copyToClipboard = (text: string, cellKey: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCell(cellKey);
      setTimeout(() => setCopiedCell(null), 1500);
    });
  };

  useEffect(() => {
    loadRecords();
    loadExportConfig();
  }, [loadRecords, loadExportConfig]);

  useEffect(() => {
    saveExportConfig({ month, attendance_days: attendanceDays });
  }, [month, attendanceDays, saveExportConfig]);

  const filteredRecords = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    switch (dateRangeType) {
      case 'month': {
        return records.filter((r) => r.date.startsWith(month));
      }
      case 'lastMonth': {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
        return records.filter((r) => r.date.startsWith(lastMonthStr));
      }
      case 'last3Months': {
        const monthStrings: string[] = [];
        for (let i = 0; i < 3; i++) {
          const d = new Date(currentYear, currentMonth - i, 1);
          monthStrings.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return records.filter((r) => monthStrings.some((m) => r.date.startsWith(m)));
      }
      case 'all': {
        return records;
      }
      default: {
        return records.filter((r) => r.date.startsWith(month));
      }
    }
  }, [records, month, dateRangeType]);

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

    // 所有"会议"项目合并为一行
    const result = Array.from(map.values());
    const meetingReqs = result.filter(r => r.project === '会议');
    const nonMeetingReqs = result.filter(r => r.project !== '会议');

    if (meetingReqs.length > 0) {
      const meetingTotalHours = meetingReqs.reduce((s, r) => s + r.hours, 0);
      nonMeetingReqs.push({
        name: '会议',
        hours: meetingTotalHours,
        project: '会议',
      });
    }

    return nonMeetingReqs;
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
              name: formatDisplayName(req.name, req.project),
              actualHours: req.hours,
              manDays: aiMatch ? aiMatch.manDays : 0.5,
              project: req.project,
              game: '',
              department: '',
              direction: '',
              laborType: '',
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
        name: formatDisplayName(r.name, r.project),
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
        <DateRangePicker
          value={month}
          dateRangeType={dateRangeType}
          onChange={handleMonthChange}
          onRangeTypeChange={setDateRangeType}
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
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">工时（人日）</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {allocationResults.map((r, i) => (
              <tr key={i}>
                <td
                  className="px-4 py-3 text-sm cursor-pointer hover:bg-blue-50 transition-colors select-all"
                  onClick={() => copyToClipboard(r.name, `name-${i}`)}
                  title="点击复制"
                >
                  {copiedCell === `name-${i}` ? (
                    <span className="text-blue-600 text-xs">已复制</span>
                  ) : (
                    r.name
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-right">{r.actualHours}h</td>
                <td
                  className="px-4 py-3 text-sm text-right cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => copyToClipboard(r.manDays.toFixed(1), `man-${i}`)}
                  title="点击复制"
                >
                  {copiedCell === `man-${i}` ? (
                    <span className="text-blue-600 text-xs">已复制</span>
                  ) : (
                    r.manDays.toFixed(1)
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-semibold">
              <td className="px-4 py-3 text-sm">总计</td>
              <td className="px-4 py-3 text-sm text-right">{totals.hours}h</td>
              <td className="px-4 py-3 text-sm text-right">{totals.manDays.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-gray-600">
        人日差值: {diff.toFixed(1)} {Math.abs(diff) < 0.1 ? '（已校正）' : '（需调整出勤天数或需求分配）'}
      </div>

      <div className="flex space-x-4">
        <button
          onClick={() => setShowExportConfirm(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          导出企微 Excel
        </button>
      </div>

      <ConfirmDialog
        isOpen={showExportConfirm}
        title="确认导出"
        message={`确定导出 ${DATE_RANGE_OPTIONS.find((o) => o.type === dateRangeType)?.label || month} 的工时报表吗？`}
        confirmLabel="确认导出"
        confirmVariant="default"
        onConfirm={() => {
          handleExportExcel();
          setShowExportConfirm(false);
        }}
        onCancel={() => setShowExportConfirm(false)}
      />
    </div>
  );
}
