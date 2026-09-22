import type { z } from "zod";

export class ParseOnReadError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(table: string, id: unknown, issues: z.ZodIssue[]) {
    super(
      `Malformed ${table} row ${String(id)}: ${issues.map((i) => i.message).join("; ")}`,
    );
    this.name = "ParseOnReadError";
    this.issues = issues;
  }
}

export function parseRow<T>(
  schema: z.ZodType<T>,
  table: string,
  row: unknown,
  id: unknown,
): T {
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new ParseOnReadError(table, id, result.error.issues);
  }
  return result.data;
}

export function parseRows<T>(
  schema: z.ZodType<T>,
  table: string,
  rows: unknown[],
  idOf: (row: unknown) => unknown,
): T[] {
  return rows.map((row) => parseRow(schema, table, row, idOf(row)));
}
