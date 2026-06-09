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
  actualHours: number;
  manDays: number;
  project: string;
  game: string;
  department: string;
  direction: string;
  laborType: string;
}

export function smartAllocate(
  requirements: Requirement[],
  attendanceDays: number,
  hoursPerDay: number = 8
): AllocationResult[] {
  if (requirements.length === 0) return [];

  // 步骤1: 每个需求保底分配（向下取整到 0.5）
  const results: AllocationResult[] = requirements.map(r => {
    const rawManDays = r.hours / hoursPerDay;
    const floorManDays = Math.floor(rawManDays * 2) / 2;
    return {
      name: r.name,
      actualHours: r.hours,
      manDays: floorManDays,
      project: r.project,
      game: '',
      department: '',
      direction: '',
      laborType: '',
    };
  });

  const totalAllocated = results.reduce((sum, r) => sum + r.manDays, 0);
  let remainingSlots = Math.round((attendanceDays - totalAllocated) * 2);

  // 步骤2: 按"离下一档距离"排序，优先补给最接近下一档的需求
  // 离下一档越远 → 越优先得到半个单位（弥补缺口）
  const indexed = results.map((r, i) => {
    const raw = r.actualHours / hoursPerDay;
    const gapToNext = raw - r.manDays; // 0 ~ 0.5
    return { ...r, index: i, gapToNext };
  });

  // 排序：gapToNext 越大越优先获得增量
  const byGapDesc = [...indexed].sort((a, b) => b.gapToNext - a.gapToNext);
  // 排序：gapToNext 越小越优先被减少（即当前值离下方最近）
  const byGapAsc = [...indexed].sort((a, b) => a.gapToNext - b.gapToNext);

  while (remainingSlots > 0) {
    // 找到离下一档最近的需求增加 0.5
    const target = byGapDesc.find(r => results[r.index].manDays < attendanceDays);
    if (!target) break;
    results[target.index].manDays += 0.5;
    remainingSlots--;
  }

  while (remainingSlots < 0) {
    // 找到人日 > 0.5 且离下一档最远（即当前值虚高）的需求减少 0.5
    const target = byGapAsc.find(r => results[r.index].manDays > 0.5);
    if (!target) break;
    results[target.index].manDays -= 0.5;
    remainingSlots++;
  }

  return results;
}

/**
 * 使用 Claude API 做全局智能分配
 */
export async function aiAllocate(
  requirements: Requirement[],
  attendanceDays: number,
  apiKey: string,
  hoursPerDay: number = 8
): Promise<{ name: string; manDays: number }[]> {
  const reqList = requirements.map(r => ({
    name: r.name,
    hours: r.hours,
    rawManDays: r.hours / hoursPerDay,
  }));

  const prompt = `你是一个工时分配助手。给定以下需求和出勤天数，请将每个需求分配到0.5人日粒度，要求总和等于出勤天数。

出勤天数: ${attendanceDays}
换算: ${hoursPerDay}h = 1 人日

需求列表:
${reqList.map((r, i) => `${i + 1}. ${r.name}: ${r.hours}h (原始 ${r.rawManDays.toFixed(2)} 人日)`).join('\n')}

规则:
- 每个需求的分配值必须是0.5的倍数（如 0.5, 1.0, 1.5, 2.0...）
- 分配总和的绝对值必须精确等于 ${attendanceDays}
- 小需求（< 0.5 人日原始值）可以合并向下取整
- 大需求可以微调吸收误差，但偏差尽量不超过1人日
- 优先保证大需求的合理性

请只返回JSON数组，格式: [{"name": "需求名", "manDays": 1.5}, ...]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI 分配请求失败: ${response.status} ${errText}`);
  }

  const json = await response.json();
  const text = json.content?.[0]?.text || '';

  // 从响应中提取 JSON 数组
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI 返回格式无法解析');

  try {
    return JSON.parse(match[0]);
  } catch {
    // 尝试修复常见 JSON 问题
    const cleaned = match[0]
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return JSON.parse(cleaned);
  }
}

export function exportToExcel(
  results: AllocationResult[],
  month: string,
  attendanceDays: number,
  hoursPerDay: number
): void {
  import('xlsx').then((XLSX) => {
    const data = [
      [`${month} 工时统计`],
      [`出勤天数: ${attendanceDays}`],
      [`换算: ${hoursPerDay}h/人日`],
      [],
      ['需求名称', '实际工时(h)', '对应游戏', '工时（人日）', '部门', '所属方向', '人力类型'],
      ...results.map((r) => [
        r.name,
        r.actualHours,
        r.game || '',
        r.manDays,
        r.department || '',
        r.direction || '',
        r.laborType || '',
      ]),
      [
        '总计',
        results.reduce((s, r) => s + r.actualHours, 0),
        '',
        results.reduce((s, r) => s + r.manDays, 0),
        '',
        '',
        '',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '工时统计');
    XLSX.writeFile(wb, `${month}_工时统计.xlsx`);
  });
}
