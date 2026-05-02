export function compactText(value: string, maxLength: number): string {
  const compact = value.trim().replaceAll(/\s+/g, ' ');
  if (compact.length <= maxLength) return compact;
  if (maxLength <= 3) return compact.slice(0, maxLength);
  return `${compact.slice(0, maxLength - 3)}...`;
}

export function parseStructuredToolError(content: string): string | undefined {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }

    const obj = parsed as { error?: unknown; message?: unknown };
    if (typeof obj.error !== 'string') return undefined;
    return typeof obj.message === 'string' ? `${obj.error}: ${obj.message}` : obj.error;
  } catch {
    return undefined;
  }
}
