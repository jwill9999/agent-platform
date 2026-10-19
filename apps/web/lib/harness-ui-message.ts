/** Public renderer state for the application's NDJSON protocol, not SDK provider replay data. */
export type HarnessUiPart =
  | { type: 'text'; text: string }
  | {
      type: 'reasoning';
      reasoning: string;
      details: Array<
        { type: 'text'; text: string; signature?: string } | { type: 'redacted'; data: string }
      >;
    }
  | {
      type: 'tool-invocation';
      toolInvocation:
        | {
            state: 'result';
            toolCallId: string;
            toolName: string;
            args: unknown;
            result: unknown;
          }
        | {
            state: 'call' | 'partial-call';
            toolCallId: string;
            toolName: string;
            args: unknown;
          };
    }
  | { type: 'source'; source: { url: string } }
  | { type: 'file'; mimeType: string; data: string }
  | { type: 'step-start' };

export type HarnessUiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  parts: HarnessUiPart[];
};
