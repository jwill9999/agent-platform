import { DiagnosticEventSchema, type DiagnosticEvent } from '@agent-platform/contracts';
export {
  buildDiagnosticReport,
  buildPartialDiagnosticReport,
  projectDiagnosticReport,
} from '@agent-platform/contracts';
/** Shared boundary for every new diagnostic sink; reject rather than redact arbitrary content. */
export function projectDiagnosticEvent(value: unknown): DiagnosticEvent | null {
  const parsed = DiagnosticEventSchema.safeParse(value);
  if (!parsed.success || new TextEncoder().encode(JSON.stringify(parsed.data)).length > 4096)
    return null;
  return parsed.data;
}
