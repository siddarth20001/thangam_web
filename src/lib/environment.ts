// Dashboard variables are sometimes pasted with the quotes used in .env files.
export function normalizeSetting(value: unknown): string {
  if (typeof value !== 'string') return ''
  let result = value.trim()
  while (result.length >= 2 && ['"', "'", '`'].includes(result[0]) && result.at(-1) === result[0]) result = result.slice(1, -1).trim()
  return result
}
export function validSupabaseUrl(value: string): boolean {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !!url.hostname } catch { return false }
}
