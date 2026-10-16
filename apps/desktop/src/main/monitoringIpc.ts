import type { IpcMainInvokeEvent, WebContents } from 'electron';

/** Monitoring is available only to the original top-level local app renderer. */
export function assertMonitoringSender(
  event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>,
  trusted: WebContents,
  rendererUrl: string,
): void {
  try {
    const allowed = new URL(rendererUrl);
    const actual = new URL(event.senderFrame?.url ?? '');
    if (
      event.sender === trusted &&
      event.senderFrame === trusted.mainFrame &&
      allowed.protocol === 'http:' &&
      ['127.0.0.1', '[::1]', 'localhost'].includes(allowed.hostname) &&
      !allowed.username &&
      !allowed.password &&
      actual.origin === allowed.origin &&
      !actual.username &&
      !actual.password
    )
      return;
  } catch {
    // Invalid frame URLs are denied without serializing their contents.
  }
  throw new Error('Rejected monitoring call from untrusted sender.');
}
