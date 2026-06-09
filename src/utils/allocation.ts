/**
 * 智能工时分配算法
 */

export interface Requirement {
  name: string;
  hours: number;
  project: string;
  merged_from?: string[];
}

export interface AllocationResult {
  name: string;
  hours: number;
  manDays: number;
  project: string;
}

export function smartAllocate(
  requirements: Requirement[],
  attendanceDays: number,
  _hoursPerDay: number = 7.5
): AllocationResult[] {
  const totalHours = requirements.reduce((sum, r) => sum + r.hours, 0);
  const totalSlots = attendanceDays * 2; // 0.5 人日 = 1 个槽位

  if (totalHours === 0 || totalSlots === 0) {
    return requirements.map((r) => ({
      name: r.name,
      hours: r.hours,
      manDays: 0,
      project: r.project,
    }));
  }

  // Step 1: 按比例分配槽位
  let remainingSlots = totalSlots;
  const results = requirements.map((r) => {
    const rawSlots = (r.hours / totalHours) * totalSlots;
    const roundedSlots = Math.max(1, Math.round(rawSlots)); // 至少 0.5 人日
    remainingSlots -= roundedSlots;
    return {
      name: r.name,
      hours: r.hours,
      slots: roundedSlots,
      manDays: roundedSlots * 0.5,
      project: r.project,
    };
  });

  // Step 2: 校正剩余槽位（按需增减最大项）
  while (remainingSlots !== 0) {
    const target = remainingSlots > 0
      ? results.reduce((a, b) => (a.hours > b.hours ? a : b))
      : results.reduce((a, b) => (a.hours < b.hours ? a : b));
    target.slots += remainingSlots > 0 ? 1 : -1;
    target.manDays = target.slots * 0.5;
    remainingSlots += remainingSlots > 0 ? -1 : 1;
  }

  return results.map(({ name, hours, manDays, project }) => ({
    name,
    hours,
    manDays,
    project,
  }));
}

export function exportToExcel(
  results: AllocationResult[],
  month: string,
  attendanceDays: number,
  hoursPerDay: number
): void {
  // 动态导入 xlsx
  import('xlsx').then((XLSX) => {
    const data = [
      [`${month} 工时统计`],
      [`出勤天数: ${attendanceDays}`],
      [`人日换算: ${hoursPerDay}h/人日`],
      [],
      ['需求', '项目', '工时(h)', '人日'],
      ...results.map((r) => [r.name, r.project, r.hours, r.manDays]),
      ['总计', '', results.reduce((s, r) => s + r.hours, 0), results.reduce((s, r) => s + r.manDays, 0)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工时统计');
    XLSX.writeFile(wb, `${month}_工时统计.xlsx`);
  });
}
