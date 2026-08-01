import type { DatasetColumn, DatasetPreview } from '../types/workflow';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const parseRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows;
};

const inferCell = (value: string): string | number | boolean | null => {
  if (value === '' || /^(na|n\/a|null)$/i.test(value)) return null;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const inferColumnType = (values: Array<string | number | boolean | null>): DatasetColumn['type'] => {
  const observed = values.filter((value) => value !== null);
  if (observed.length === 0) return 'string';
  if (observed.every((value) => typeof value === 'boolean')) return 'boolean';
  if (observed.every((value) => typeof value === 'number')) {
    return observed.every((value) => Number.isInteger(value)) ? 'integer' : 'number';
  }
  return 'string';
};

const fingerprint = async (buffer: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex.slice(0, 12)}…${hex.slice(-6)}`;
};

export const parseLocalCsv = async (file: File): Promise<DatasetPreview> => {
  if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Choose a CSV file for local preview.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('This browser preview accepts CSV files up to 50 MB.');

  const buffer = await file.arrayBuffer();
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  const parsed = parseRows(text);
  const header = parsed[0];
  if (!header || header.length === 0) throw new Error('The CSV does not contain a header row.');
  const normalizedHeader = header.map((name, index) => name || `column_${index + 1}`);
  if (new Set(normalizedHeader).size !== normalizedHeader.length) {
    throw new Error('CSV column names must be unique before import.');
  }

  const dataRows = parsed.slice(1);
  const typedRows = dataRows.slice(0, 50).map((cells) =>
    Object.fromEntries(normalizedHeader.map((name, index) => [name, inferCell(cells[index] ?? '')])),
  );
  const columns: DatasetColumn[] = normalizedHeader.map((name) => {
    const values = typedRows.map((row) => row[name] ?? null);
    return {
      name,
      type: inferColumnType(values),
      missing: dataRows.reduce((count, cells) => {
        const index = normalizedHeader.indexOf(name);
        return count + (inferCell(cells[index] ?? '') === null ? 1 : 0);
      }, 0),
    };
  });

  return {
    id: `local-${crypto.randomUUID().slice(0, 8)}`,
    name: file.name,
    source: 'local-upload',
    rowCount: dataRows.length,
    columnCount: normalizedHeader.length,
    sampled: dataRows.length > typedRows.length,
    fingerprint: await fingerprint(buffer),
    columns,
    rows: typedRows,
  };
};
