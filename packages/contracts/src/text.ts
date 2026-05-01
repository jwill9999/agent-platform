export function compactText(value: string, maxLength: number): string {
  const compact = value.trim().replaceAll(/\s+/g, ' ');
  if (compact.length <= maxLength) return compact;
  if (maxLength <= 3) return compact.slice(0, maxLength);
  return `${compact.slice(0, maxLength - 3)}...`;
}
