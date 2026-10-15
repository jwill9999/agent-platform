/** Match JavaScript's original UTF-16 ordinal ordering, independent of host locale. */
export function compareGitDeliveryStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
