export interface LakeRecord {
  date: string;
  usage: string;
  hours: string;
  status: string;
  content_tags: string[];
  project: string;
}

export interface ParsedLakeData {
  records: LakeRecord[];
  columns: {
    id: string;
    name: string;
    type: string;
    options?: { id: string; value: string }[];
  }[];
}

function urlDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function parseLakeFile(content: string): ParsedLakeData {
  const cardMatch = content.match(
    /<card[^>]*type="block"[^>]*name="dataTable"[^>]*value="([^"]+)"[^>]*>/
  );

  if (!cardMatch) {
    const altMatch = content.match(
      /<card[^>]*value="([^"]+)"[^>]*type="block"[^>]*name="dataTable"[^>]*>/
    );
    if (!altMatch) {
      throw new Error('无法找到 dataTable card 元素');
    }
    return processCardValue(altMatch[1]);
  }

  return processCardValue(cardMatch[1]);
}

function processCardValue(value: string): ParsedLakeData {
  const dataStart = value.indexOf('data:');
  let encodedJson = value;
  if (dataStart !== -1) {
    encodedJson = value.substring(dataStart + 5);
  }

  const decoded = urlDecode(encodedJson);
  const outerData = JSON.parse(decoded);

  const content = typeof outerData.content === 'string' ? JSON.parse(outerData.content) : outerData.content;

  const sheets = content.sheet || content.sheets || [];
  const records = content.records || [];

  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error('未找到有效的 sheet');
  }

  const sheet = sheets[0];
  const columns = sheet.columns || [];

  const colMap: Record<string, string> = {};
  const columnOptions: Record<string, Record<string, string>> = {};
  
  columns.forEach((c: { id: string; name: string; options?: { id: string; value: string }[] }) => {
    colMap[c.name] = c.id;
    if (c.options && Array.isArray(c.options)) {
      columnOptions[c.id] = {};
      c.options.forEach((opt) => {
        if (opt.id && opt.value) {
          columnOptions[c.id][opt.id] = opt.value;
        }
      });
    }
  });

  const parsedColumns = columns.map((c: { id: string; name: string; type: string; options?: { id: string; value: string }[] }) => ({
    id: c.id,
    name: c.name,
    type: c.type || 'unknown',
    options: c.options,
  }));

  const parsedRecords: LakeRecord[] = records.map((record: { data: string }) => {
    const data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;

    const getRawValue = (colId: string): unknown => {
      const rawValue = data?.[colId];
      if (rawValue && typeof rawValue === 'object' && 'value' in rawValue) {
        return (rawValue as { value: unknown }).value;
      }
      return rawValue;
    };

    const decodeOptionValue = (colId: string, value: unknown): string => {
      if (typeof value !== 'string') {
        return String(value);
      }
      const options = columnOptions[colId];
      if (options && options[value]) {
        return options[value];
      }
      return value;
    };

    const decodeMultiSelectValue = (colId: string, values: unknown): string[] => {
      if (!Array.isArray(values)) {
        return [];
      }
      const options = columnOptions[colId];
      return values.map((v) => {
        if (typeof v === 'string' && options && options[v]) {
          return options[v];
        }
        return String(v);
      });
    };

    const decodeDateValue = (colId: string): string => {
      const value = getRawValue(colId);
      if (value && typeof value === 'object' && 'text' in value) {
        return String((value as { text: string }).text);
      }
      return String(value || '');
    };

    return {
      date: decodeDateValue(colMap['使用日期'] || ''),
      usage: decodeOptionValue(colMap['使用情况'] || '', getRawValue(colMap['使用情况'] || '')),
      hours: decodeOptionValue(colMap['使用时间'] || '', getRawValue(colMap['使用时间'] || '')),
      status: decodeOptionValue(colMap['使用状态'] || '', getRawValue(colMap['使用状态'] || '')),
      content_tags: decodeMultiSelectValue(colMap['工时内容'] || '', getRawValue(colMap['工时内容'] || '')),
      project: decodeOptionValue(colMap['所属项目'] || '', getRawValue(colMap['所属项目'] || '')),
    };
  });

  return { records: parsedRecords, columns: parsedColumns };
}

export function hoursToNumber(hoursStr: string): number {
  const match = hoursStr.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * 解析 xlsx 文件
 */
export async function parseXlsxFile(content: ArrayBuffer): Promise<ParsedLakeData> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(content, { type: 'array' });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet);

  // 尝试推断列名
  if (json.length === 0) {
    return { records: [], columns: [] };
  }

  const firstRow = json[0] as Record<string, unknown>;
  const columnNames = Object.keys(firstRow);

  // 找到关键列的位置
  const dateCol = columnNames.find((c) => c.includes('日期'));
  const hoursCol = columnNames.find((c) => c.includes('时间') || c.includes('工时'));
  const projectCol = columnNames.find((c) => c.includes('项目'));
  const contentCol = columnNames.find((c) => c.includes('内容') || c.includes('需求') || c.includes('工时'));

  const records: LakeRecord[] = json.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      date: String(r[dateCol || ''] || ''),
      usage: '',
      hours: String(r[hoursCol || ''] || '1'),
      status: '',
      content_tags: contentCol ? [String(r[contentCol] || '')] : [],
      project: String(r[projectCol || ''] || ''),
    };
  });

  const columns = columnNames.map((name) => ({
    id: name,
    name: name,
    type: 'text',
  }));

  return { records, columns };
}