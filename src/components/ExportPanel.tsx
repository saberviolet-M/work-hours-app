import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAppStore } from '../store/useAppStore';
import { smartAllocate, exportToExcel, Requirement } from '../utils/allocation';

const EXCLUDED_TAGS = ['上线', '联调', '测试', '测试用例', '用例评审', '审批', '需求评审', '技术评审'];

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
  const [hoursPerDay, setHoursPerDay] = useState(settings.hours_per_day);
  const [aiEnabled, setAiEnabled] = useState(true);

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
      let key = r.requirement_name;
      let project = r.project;

      if (project === '会议') {
        key = '会议';
        project = '会议';
      } else {
        const tags = r.raw_tags || [];
        const validTags = tags.filter((tag) => !EXCLUDED_TAGS.includes(tag));
        
        if (validTags.length > 0) {
          key = validTags.join(' / ') + ` (${r.requirement_name})`;
        }
      }

      const existing = map.get(key);
      if (existing) {
        existing.hours += r.hours;
      } else {
        map.set(key, {
          name: key,
          hours: r.hours,
          project: project,
        });
      }
    });

    return Array.from(map.values());
  }, [filteredRecords]);

  const groupedRequirements = useMemo(() => {
    const grouped: Record<string, Requirement[]> = {};
    
    requirements.forEach((req) => {
      const project = req.project || '其他';
      if (!grouped[project]) {
        grouped[project] = [];
      }
      grouped[project].push(req);
    });

    return Object.entries(grouped).map(([project, items]) => ({
      project,
      items,
      totalHours: items.reduce((s, r) => s + r.hours, 0),
    }));
  }, [requirements]);

  const allocationResults = useMemo(() => {
    const allResults: ReturnType<typeof smartAllocate> = [];
    
    groupedRequirements.forEach((group) => {
      const results = aiEnabled 
        ? smartAllocate(group.items, attendanceDays, hoursPerDay)
        : group.items.map((r) => ({ ...r, manDays: r.hours / hoursPerDay }));
      allResults.push(...results.map((r) => ({ ...r, project: group.project })));
    });

    return allResults;
  }, [groupedRequirements, attendanceDays, hoursPerDay, aiEnabled]);

  const totals = useMemo(() => {
    return {
      hours: allocationResults.reduce((s, r) => s + r.hours, 0),
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

      <div className="flex space-x-4 items-center">
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
        <span>人日换算:</span>
        <input
          type="number"
          value={hoursPerDay}
          onChange={(e) => setHoursPerDay(Number(e.target.value))}
          className="w-20 px-3 py-2 border rounded"
        />
        <span>h/人日</span>
        <label className="flex items-center space-x-2 ml-4">
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => setAiEnabled(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span>AI 智能分配</span>
        </label>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">所属项目</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">需求</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">工时</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">人日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {groupedRequirements.map((group, groupIndex) => (
              <Fragment key={group.project}>
                {group.items.map((r, i) => {
                  const result = allocationResults.find(
                    (ar) => ar.name === r.name && ar.project === group.project
                  );
                  return (
                    <tr key={`${groupIndex}-${i}`}>
                      {i === 0 && (
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 row-span" rowSpan={group.items.length}>
                          {group.project}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm">{r.name}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.hours}h</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {result ? result.manDays.toFixed(1) : (r.hours / hoursPerDay).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            <tr className="bg-gray-100 font-semibold">
              <td className="px-4 py-3 text-sm">总计</td>
              <td className="px-4 py-3 text-sm"></td>
              <td className="px-4 py-3 text-sm text-right">{totals.hours}h</td>
              <td className="px-4 py-3 text-sm text-right">{totals.manDays.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-gray-600">
        人日差值: {diff.toFixed(1)} {Math.abs(diff) < 0.1 ? '（已校正）' : ''}
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