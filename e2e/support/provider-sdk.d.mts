export const SDK_FIXTURE_KEY: string;
export const SDK_PRIVATE_MARKER: string;
export const SDK_PROVIDERS: string[];
export type SdkFixtureRequest = {
  provider: string;
  path: string;
  model: string;
  stream: boolean;
  credentialMatched: boolean;
  continuationMatched: boolean;
  resumedTool: boolean;
  outputCap?: number;
  legacyMaxTokens: boolean;
  store?: boolean;
};
export function startProviderSdkFixture(options?: {
  onRecord?: (record: SdkFixtureRequest) => void;
  onError?: (error: string) => void;
}): Promise<{
  baseURL: string;
  requests: SdkFixtureRequest[];
  errors: string[];
  enqueueTool: (tool: { path: string; content: string }) => number;
  close: () => Promise<void>;
}>;
