import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { smartAllocate, exportToExcel, Requirement } from '../utils/allocation';

export function ExportPanel() {
  const { records, loadRecords, settings } = useAppStore();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendanceDays, setAttendanceDays] = useState(settings.default_attendance_days);
  const [hoursPerDay, setHoursPerDay] = useState(settings.hours_per_day);
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const requirements = useMemo(() => {
    const map = new Map<string, Requirement>();

    records
      .filter((r) => r.date.startsWith(month))
      .forEach((r) => {
        const key = r.requirement_name;
        const existing = map.get(key);
        if (existing) {
          existing.hours += r.hours;
        } else {
          map.set(key, {
            name: r.requirement_name,
            hours: r.hours,
            project: r.project,
          });
        }
      });

    return Array.from(map.values());
  }, [records, month]);

  const allocationResults = useMemo(() => {
    if (!aiEnabled) return requirements.map((r) => ({ ...r, manDays: r.hours / hoursPerDay }));
    return smartAllocate(requirements, attendanceDays, hoursPerDay);
  }, [requirements, attendanceDays, hoursPerDay, aiEnabled]);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">月度报表导出</h1>

      <div className="flex space-x-4 items-center">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">需求</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">工时</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">人日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {allocationResults.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-sm">{r.name}</td>
                <td className="px-4 py-3 text-sm text-right">{r.hours}h</td>
                <td className="px-4 py-3 text-sm text-right">{r.manDays.toFixed(1)}</td>
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
