import { appendMessage, type DrizzleDb } from '@agent-platform/db';
import { redactCredentials, type OutputEmitter } from '@agent-platform/harness';

/** Preserve the already displayed reply if Stop ends the HTTP wait before the graph settles. */
export function captureInterruptedReply(
  db: DrizzleDb,
  sessionId: string,
  destination: OutputEmitter,
  signal: AbortSignal,
) {
  const text: string[] = [];
  let saved = false;
  return {
    emitter: {
      emit: (event) => {
        if (signal.aborted) return;
        if (event.type === 'text') text.push(event.content);
        return destination.emit(event);
      },
      end: () => destination.end(),
    } satisfies OutputEmitter,
    // The SDK barrier has committed this prefix. Keep capturing later model text.
    checkpoint: () => {
      text.length = 0;
    },
    markSaved: () => {
      saved = true;
    },
    save: () => {
      if (saved || text.length === 0) return;
      saved = true;
      appendMessage(db, {
        sessionId,
        role: 'assistant',
        content: redactCredentials(text.join('')),
      });
    },
  };
}
