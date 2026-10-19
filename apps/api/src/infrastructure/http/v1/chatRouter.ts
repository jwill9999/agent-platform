import {
  getRunControlService,
  type ControlledExecution,
} from '../../../application/runControl/service.js';
import { mapRunControlError } from './runControlRouter.js';
import { captureInterruptedReply } from './interruptedReply.js';
import { createGitDeliveryService } from '../../../application/gitDelivery/index.js';
import { parseToolId } from '@agent-platform/agent-validation';
import {
  beginDiagnosticRun,
  failDiagnosticRun,
  observeDiagnosticNode,
  observeDiagnosticContextDecision,
  observeDiagnosticModelAttempt,
  observeDiagnosticTool,
  observeDiagnosticApproval,
  observeDiagnosticRunControl,
} from '../../diagnostics/observations.js';
import type { DrizzleDb } from '@agent-platform/db';
import {
  getSession,
  getMcpServer,
  loadAgentById,
  getSkill,
  appendMessage,
  listMessagesWithContinuation,
  appendMessageWithContinuation,
  ProviderContinuationError,
  modelConfigCredentialRevision,
  type ProviderContinuationBinding,
  updateSessionTitle,
  withTransaction,
  insertToolExecution,
  completeToolExecution,
  createApprovalRequest,
  getApprovalRequest,
  getGitDeliveryOperation,
  getWorkingMemoryArtifact,
  claimApprovalRequestForResume,
  ApprovalRequestAlreadyResumedError,
  ApprovalRequestNotFoundError,
  ApprovalRequestTransitionError,
  getModelConfig,
  listApprovalRequests,
  listModelConfigs,
  resolveModelConfigKey,
  parseMasterKeyFromBase64,
  SecretDecryptionError,
  upsertWorkingMemoryArtifact,
  createMemoryCandidates,
  retrievePromptMemories,
  formatPromptMemoryBundle,
  findProject,
  loadSettings,
} from '@agent-platform/db';
import type {
  ApprovalRequest,
  MessageRecord,
  Output,
  PromptMemoryBundle,
  ProjectRecord,
  ProjectAccessPolicy,
  RunControlReason,
  RunControlState,
  SensorAgentProfile,
  SessionRecord,
  Tool as ContractTool,
  WorkingMemoryToolSummary,
} from '@agent-platform/contracts';
import {
  compactText,
  DEFAULT_CONTEXT_WINDOW,
  parseStructuredToolError,
  SessionResumeBodySchema,
} from '@agent-platform/contracts';
import {
  PROVIDER_CONTINUATION_RECOVERY_MESSAGE,
  type AgentContext,
  buildAgentContext,
  destroyAgentContext,
  AgentNotFoundError,
  buildHarnessGraph,
  createLlmReasonNode,
  attachProviderContinuation,
  getProviderContinuation,
  continuationBindingMatches,
  validateProviderContinuation,
  createToolDispatchNode,
  createSensorCheckNode,
  createNdjsonEmitter,
  contractToolsToDefinitions,
  createSystemToolExecutor,
  isGitDeliveryTool,
  parseGitDeliveryToolAction,
  PathJail,
  DEFAULT_MOUNTS,
  createToolAuditLogger,
  redactCredentials,
  type ChatMessage,
  type HarnessStateType,
  type NativeToolExecutor,
  type OutputEmitter,
  type ToolAuditStore,
  type ToolCallIntent,
  type McpApprovalBinding,
} from '@agent-platform/harness';
import {
  resolveModelConfig,
  openAiKeyGateToApiOutcome,
  resolveGatedOpenAiKeyForRequest,
  streamChat,
  PROVIDER_CATALOGUE,
  providerEndpointIdentity,
} from '@agent-platform/model-router';
import type { ObservabilityStore } from '@agent-platform/plugin-observability';
import type { RegisteredPlugin } from '@agent-platform/plugin-session';
import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { isAbsolute, relative, sep } from 'node:path';
import { z } from 'zod';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { resolveSessionWorkspace } from '../../projects/projectWorkspaceResolver.js';
import type { ProjectWorkspaceResolution } from '../../projects/projectWorkspaceResolver.js';
import {
  buildProjectInstructionPrompt,
  parseProjectInstructionFileReferences,
} from '../../projects/projectInstructions.js';
import { startProjectOnboardingDraft } from '../../projects/projectOnboardingWorkflow.js';
import {
  runSlashCommand,
  type RunSlashCommandOptions,
} from '../../../application/slashCommands/runSlashCommand.js';
import {
  createBuiltinSlashCommandRegistry,
  formatInitDraftMessage,
} from '../../../application/slashCommands/builtin.js';
import { createInProcessSessionLock, type SessionLock } from '../sessionLock.js';
import { parseBody } from './routerUtils.js';

const PROJECT_WRITE_TOOL_IDS = new Set([
  'sys_write_file',
  'sys_append_file',
  'sys_copy_file',
  'sys_create_directory',
  'sys_download_file',
  'coding_apply_patch',
]);

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const ChatBodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

const LegacyChatStreamBodySchema = z.object({
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Extracted helpers — keep the route handlers flat
// ---------------------------------------------------------------------------

const MAX_TITLE_LENGTH = 80;
const defaultSlashCommandRegistry = createBuiltinSlashCommandRegistry();

type SessionProjectContext = {
  projectId?: string;
  project?: ProjectRecord;
};

export type ChatRouterOptions = {
  globalPlugins?: readonly RegisteredPlugin[];
  observabilityStore?: ObservabilityStore;
  llmReasonNode?: ReturnType<typeof createLlmReasonNode>;
  disableEvaluatorNodes?: boolean;
  emitFinalAssistantMessage?: boolean;
  sessionLock?: SessionLock;
  slashCommands?: RunSlashCommandOptions;
  systemToolExecutorFactory?: (context: {
    sessionId: string;
    runId: string;
    agentId: string;
    defaultRepoPath?: string;
  }) => NativeToolExecutor;
};

type RuntimeGraphInput = {
  db: DrizzleDb;
  agentCtx: AgentContext;
  runId: string;
  sessionId: string;
  emitter: OutputEmitter;
  options: ChatRouterOptions;
  approvedToolCallIds?: ReadonlySet<string>;
  nativeToolExecutor?: NativeToolExecutor;
  onMessagesPersisted?: () => void;
};

function resolveSlashCommandOptions(options?: RunSlashCommandOptions): RunSlashCommandOptions {
  return options ?? { registry: defaultSlashCommandRegistry };
}

/** Derive a human-readable session title from the first user message. */
function deriveSessionTitle(message: string): string {
  const trimmed = message.trim().replaceAll(/\s+/g, ' ');
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  const cut = trimmed.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > MAX_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Build agent context; translates AgentNotFoundError to HttpError. */
async function loadAgentContext(
  db: DrizzleDb,
  agentId: string,
  options: Pick<ChatRouterOptions, 'globalPlugins'> & { signal?: AbortSignal } = {},
): Promise<AgentContext> {
  try {
    return await buildAgentContext(db, agentId, {
      globalPlugins: options.globalPlugins,
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      throw new HttpError(404, 'NOT_FOUND', `Agent '${agentId}' not found`);
    }
    throw err;
  }
}

type ResolvedChatModel = {
  provider: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
  continuationBinding?: ProviderContinuationBinding;
};

function bindContinuation(
  config: ResolvedChatModel,
  credentialRevision: string,
): ResolvedChatModel {
  const mode = PROVIDER_CATALOGUE.find((provider) => provider.id === config.provider)?.apiMode;
  if (!mode) throw new HttpError(400, 'MODEL_PROVIDER_UNSUPPORTED', 'Choose a supported provider.');
  return {
    ...config,
    continuationBinding: {
      provider: config.provider,
      model: config.model,
      apiMode: mode,
      endpoint: providerEndpointIdentity(config),
      credentialRevision,
    },
  };
}

async function acquireRuntimeContext(
  db: DrizzleDb,
  session: SessionRecord,
  options: ChatRouterOptions,
  req: Request,
  sessionLock: SessionLock,
  signal: AbortSignal,
) {
  const agentCtx = await loadAgentContext(db, session.agentId, {
    globalPlugins: options.globalPlugins,
    signal,
  });
  let release: (() => void) | undefined;
  try {
    const timeoutMs = agentCtx.agent.executionLimits.timeoutMs;
    release = await sessionLock.acquire(session.id, timeoutMs);
    if (signal.aborted) throw new HttpError(499, 'REQUEST_CANCELLED', 'Request was cancelled.');
    // Settings may change while this request waits for the session mutex.
    const modelCfg = resolveModelOrThrow(
      db,
      agentCtx,
      req.header('x-openai-key'),
      req.header('x-model-config-id') || undefined,
    );
    return { agentCtx, modelCfg, timeoutMs, release };
  } catch (error) {
    release?.();
    await destroyAgentContext(agentCtx);
    throw error;
  }
}

type ControlledContextInput = {
  db: DrizzleDb;
  session: SessionRecord;
  options: ChatRouterOptions;
  req: Request;
  res: Response;
  sessionLock: SessionLock;
  runId: string;
  sourceExecutionId?: string;
};

function controlledResponseReason(signal: AbortSignal, failed = false): RunControlReason {
  if (signal.reason === 'user_stop') return 'user_stop';
  if (signal.reason === 'timeout') return 'timeout';
  if (signal.aborted) return 'client_disconnect';
  return failed ? 'execution_failed' : 'none';
}

function controlledResponseState(reason: RunControlReason, waiting: boolean): RunControlState {
  if (reason === 'user_stop') return 'completed';
  if (reason === 'execution_failed') return 'failed';
  if (reason !== 'none') return 'interrupted';
  return waiting ? 'waiting_for_approval' : 'completed';
}

async function acquireControlledContext({
  db,
  session,
  options,
  req,
  res,
  sessionLock,
  runId,
  sourceExecutionId,
}: ControlledContextInput) {
  let execution: ControlledExecution;
  try {
    execution = getRunControlService(db, observeDiagnosticRunControl).open(
      session,
      runId,
      sourceExecutionId,
    );
  } catch (error) {
    mapRunControlError(error);
  }
  const { controller, signal } = execution;
  res.setHeader('x-harness-run-id', execution.runId);
  res.setHeader('x-harness-execution-id', runId);
  res.once('close', () => {
    if (!res.writableFinished) controller.abort('client_disconnect');
  });
  try {
    const runtime = await execution.waitFor(
      execution.invoke('setup', () =>
        acquireRuntimeContext(db, session, options, req, sessionLock, signal),
      ),
    );
    return { ...runtime, execution, controller, signal };
  } catch (error) {
    const reason = controlledResponseReason(signal, true);
    const record = execution.finish(controlledResponseState(reason, false), reason);
    failDiagnosticRun(signal, record.state === 'outcome_unknown');
    if (!signal.aborted) throw error;
    prepareNdjsonResponse(res);
    emitStreamError(res, error, signal);
    if (!res.writableEnded) res.end();
    return undefined;
  }
}

function finishControlledResponse(
  execution: ControlledExecution,
  waiting: boolean,
  failed = false,
) {
  const reason = controlledResponseReason(execution.signal, failed);
  return execution.finish(controlledResponseState(reason, waiting), reason);
}

function requiredSecretsMasterKey(): Buffer {
  const masterKeyB64 = process.env['SECRETS_MASTER_KEY'];
  if (!masterKeyB64) {
    throw new HttpError(500, 'CONFIGURATION_ERROR', 'SECRETS_MASTER_KEY is not configured');
  }
  return parseMasterKeyFromBase64(masterKeyB64);
}

function apiKeyForModelConfig(
  db: DrizzleDb,
  config: NonNullable<ReturnType<typeof getModelConfig>>,
): string | undefined {
  if (!config.hasApiKey) return undefined;
  return resolveStoredModelConfigKeyOrThrow(db, config.id, requiredSecretsMasterKey());
}

function resolvedConfiguredModel(
  db: DrizzleDb,
  config: NonNullable<ReturnType<typeof getModelConfig>>,
): ResolvedChatModel {
  return bindContinuation(
    {
      provider: config.provider,
      model: config.model,
      apiKey: apiKeyForModelConfig(db, config),
      baseURL: config.baseURL ?? undefined,
    },
    modelConfigCredentialRevision(db, config.id),
  );
}

function resolveExplicitModelConfig(
  db: DrizzleDb,
  effectiveModelConfigId: string | undefined,
  requestModelConfigId?: string,
): ResolvedChatModel | undefined {
  if (!effectiveModelConfigId) return undefined;

  const cfg = getModelConfig(db, effectiveModelConfigId);
  if (!cfg) {
    throw new HttpError(404, 'NOT_FOUND', `Model config '${effectiveModelConfigId}' not found`);
  }
  // Credential requirements belong to the shared provider catalogue, including local keyless adapters.
  const provider = PROVIDER_CATALOGUE.find((entry) => entry.id === cfg.provider);
  if (!provider)
    throw new HttpError(400, 'MODEL_PROVIDER_UNSUPPORTED', 'Choose a supported provider.');
  if (requestModelConfigId && provider.requiresApiKey && !cfg.hasApiKey) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      `Model config '${effectiveModelConfigId}' has no API key stored`,
    );
  }
  return resolvedConfiguredModel(db, cfg);
}

function resolveDefaultModelConfig(db: DrizzleDb): ResolvedChatModel | undefined {
  const defaultModelConfig = listModelConfigs(db).find((config) => {
    const provider = PROVIDER_CATALOGUE.find((entry) => entry.id === config.provider);
    return provider && (config.hasApiKey || !provider.requiresApiKey);
  });
  return defaultModelConfig ? resolvedConfiguredModel(db, defaultModelConfig) : undefined;
}

let processFallbackPurposeSecret: Buffer | undefined;

function fallbackPurposeSecret(): Buffer {
  const masterKey = process.env['SECRETS_MASTER_KEY'];
  if (masterKey === undefined) {
    if (processFallbackPurposeSecret === undefined) processFallbackPurposeSecret = randomBytes(32);
    return processFallbackPurposeSecret;
  }
  if (!/^[A-Za-z\d+/]{43}=$/.test(masterKey))
    throw new Error('Invalid fallback master key configuration');
  const parsedMasterKey = parseMasterKeyFromBase64(masterKey);
  if (parsedMasterKey.toString('base64') !== masterKey)
    throw new Error('Invalid fallback master key configuration');
  return createHmac('sha256', parsedMasterKey)
    .update('agent-platform/fallback-revision-purpose/v1')
    .digest();
}

/** Private signing identity, never a reusable unkeyed verifier of the API credential. */
function fallbackCredentialRevision(config: ResolvedChatModel): string {
  const purposeSecret = fallbackPurposeSecret();
  const credential = config.apiKey;
  return createHmac('sha256', credential ?? purposeSecret)
    .update(
      credential !== undefined
        ? 'agent-platform/fallback-revision/credential/v1\0'
        : 'agent-platform/fallback-revision/keyless/v1\0',
    )
    .update(purposeSecret)
    .update(
      JSON.stringify({ provider: config.provider, model: config.model, baseURL: config.baseURL }),
    )
    .digest('hex');
}

/** Resolve model config or throw an HttpError on failure.
 *
 * Precedence (highest → lowest):
 *  1. `requestModelConfigId` — per-request override from the chat UI picker
 *  2. `agentCtx.agent.modelConfigId` — agent's saved config
 *  3. First saved model config with credentials — platform default from Settings > Models
 *  4. `agentCtx.agent.modelOverride` + `headerKey` (x-openai-key) + env-var chain
 *
 * Single-user MVP note: model configs are not scoped per-user. If multi-tenancy is
 * added in future, enforce that `effectiveModelConfigId` belongs to the requesting user
 * before calling `getModelConfig`.
 */
function resolveModelOrThrow(
  db: DrizzleDb,
  agentCtx: AgentContext,
  headerKey: string | undefined,
  requestModelConfigId?: string,
): ResolvedChatModel {
  // Effective model config ID: per-request override wins over agent's stored config.
  const effectiveModelConfigId = requestModelConfigId ?? agentCtx.agent.modelConfigId;

  const explicitModel = resolveExplicitModelConfig(
    db,
    effectiveModelConfigId,
    requestModelConfigId,
  );
  if (explicitModel) return explicitModel;

  const defaultModel = resolveDefaultModelConfig(db);
  if (defaultModel) return defaultModel;

  // Fall back to free-form modelOverride + env-var chain.
  const resolution = resolveModelConfig({
    agentOverride: agentCtx.agent.modelOverride ?? null,
    headerKey,
  });
  if (resolution.kind === 'error') {
    throw new HttpError(400, resolution.code, resolution.message);
  }
  return bindContinuation(resolution.config, fallbackCredentialRevision(resolution.config));
}

function resolveStoredModelConfigKeyOrThrow(
  db: DrizzleDb,
  modelConfigId: string,
  masterKey: Buffer,
): string {
  try {
    return resolveModelConfigKey(db, modelConfigId, masterKey);
  } catch (error) {
    if (error instanceof SecretDecryptionError) {
      throw new HttpError(
        409,
        'MODEL_CONFIG_KEY_DECRYPTION_FAILED',
        'The selected model API key can no longer be decrypted. Re-enter the API key in Settings > Models.',
      );
    }
    throw error;
  }
}

/** Map persisted MessageRecord rows to ChatMessage objects. */
export function dbRecordToChatMessage(m: MessageRecord): ChatMessage {
  if (m.role === 'tool' && m.toolCallId) {
    return { id: m.id, role: 'tool', content: m.content, toolCallId: m.toolCallId, toolName: '' };
  }
  if (m.role === 'assistant') {
    return {
      id: m.id,
      role: 'assistant',
      content: m.content,
      toolCalls: m.toolCalls,
    };
  }
  return { id: m.id, role: m.role as 'user' | 'assistant' | 'system', content: m.content };
}

/** Restore tool names absent from the DB row without dropping or rearranging history. */
function persistedHistory(records: MessageRecord[]): ChatMessage[] {
  const names = new Map(
    records.flatMap((record) =>
      (record.toolCalls ?? []).map((call) => [call.id, call.name] as const),
    ),
  );
  return records.map((record) => {
    const message = dbRecordToChatMessage(record);
    return message.role === 'tool'
      ? { ...message, toolName: names.get(message.toolCallId) ?? '' }
      : message;
  });
}

function loadPrivateHistory(db: DrizzleDb, sessionId: string): ChatMessage[] {
  const stored = listMessagesWithContinuation(db, sessionId, optionalContinuationKey());
  const publicMessages = persistedHistory(stored.map((entry) => entry.message));
  return publicMessages.map((message, index) => {
    const record = stored[index]!.continuation;
    if (!record) return message;
    validateProviderContinuation(message, record);
    return attachProviderContinuation(message, record);
  });
}

function optionalContinuationKey(): Buffer | undefined {
  return process.env['SECRETS_MASTER_KEY'] ? requiredSecretsMasterKey() : undefined;
}

function rehydrateContinuation(
  db: DrizzleDb,
  sessionId: string,
  messages: ChatMessage[],
): ChatMessage[] {
  const stored = new Map(loadPrivateHistory(db, sessionId).map((message) => [message.id, message]));
  return messages.map((message) => {
    const saved = message.id ? stored.get(message.id) : undefined;
    const record = saved ? getProviderContinuation(saved) : getProviderContinuation(message);
    return record ? attachProviderContinuation(message, record) : message;
  });
}

function assertPendingContinuationBinding(
  messages: ChatMessage[],
  binding: ProviderContinuationBinding | undefined,
  toolCallId: string,
): void {
  for (const message of messages) {
    if (message.role !== 'assistant' || !message.toolCalls?.some((call) => call.id === toolCallId))
      continue;
    const record = getProviderContinuation(message);
    if (record && (!binding || !continuationBindingMatches(record.binding, binding)))
      throw new Error(
        'MODEL_CONTINUATION_CHANGED: The model configuration changed while approval was pending. Start a new request.',
      );
  }
}

/** Persist only the new assistant/tool messages the graph appended. */
function persistNewMessages(
  db: DrizzleDb,
  sessionId: string,
  allMessages: ChatMessage[] | undefined,
  initialCount: number,
): void {
  if (!allMessages) return;
  withTransaction(db, (tx) => {
    for (const msg of rehydrateContinuation(tx, sessionId, allMessages.slice(initialCount))) {
      if (msg.role !== 'assistant' && msg.role !== 'tool') continue;
      msg.id ??= randomUUID();
      appendMessageWithContinuation(
        tx,
        {
          id: msg.id,
          sessionId,
          role: msg.role,
          content: msg.content,
          toolCallId: msg.role === 'tool' ? msg.toolCallId : undefined,
          toolCalls: msg.role === 'assistant' ? msg.toolCalls : undefined,
          continuation: getProviderContinuation(msg),
        },
        optionalContinuationKey(),
        1,
      );
    }
  });
}

async function emitFinalAssistantMessage(
  emitter: OutputEmitter,
  allMessages: ChatMessage[] | undefined,
  initialCount: number,
): Promise<void> {
  const assistantText = allMessages
    ?.slice(initialCount)
    .find((msg) => msg.role === 'assistant' && msg.content.trim())?.content;
  if (assistantText) {
    await emitter.emit({ type: 'text', content: assistantText });
  }
}

/** Safely fire a plugin hook, swallowing errors. */
async function safePluginCall(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    /* plugin errors must not crash the request */
  }
}

function abortedStreamEvent(signal: AbortSignal) {
  if (signal.reason === 'timeout')
    return { type: 'error' as const, code: 'TIMEOUT', message: 'Execution timeout exceeded' };
  if (signal.reason === 'user_stop')
    return {
      type: 'error' as const,
      code: 'USER_STOP',
      message: 'Stop acknowledged. Previously admitted effects may still be settling.',
    };
  return { type: 'stream_aborted' as const, reason: 'client_disconnect' as const };
}

/** Build and write an NDJSON error event when the stream is still writable. */
function emitStreamError(res: Response, err: unknown, signal?: AbortSignal): void {
  if (res.writableEnded) return;

  if (signal?.aborted) {
    res.write(JSON.stringify(abortedStreamEvent(signal)) + '\n');
    return;
  }

  const rawMessage = err instanceof Error ? err.message : 'Graph execution failed';
  // Only typed storage failures and exact local guard messages receive this recovery projection.
  const continuationFailure =
    err instanceof ProviderContinuationError ||
    [
      PROVIDER_CONTINUATION_RECOVERY_MESSAGE,
      'PROVIDER_CONTINUATION_UNAVAILABLE',
      'Provider continuation is unavailable or invalid. Start a new request.',
      'Provider continuation exceeds the session limit.',
      'Provider continuation exceeds the session limit. Start a new chat.',
    ].includes(rawMessage);
  if (continuationFailure) {
    res.write(
      JSON.stringify({
        type: 'error',
        code: 'PROVIDER_CONTINUATION_UNAVAILABLE',
        message: PROVIDER_CONTINUATION_RECOVERY_MESSAGE,
      }) + '\n',
    );
    return;
  }
  const authError = isProviderAuthError(rawMessage);
  const message = authError
    ? 'The model provider rejected the configured API key. Check the selected model config or server environment key.'
    : redactCredentials(rawMessage);
  const errorEvent = {
    type: 'error' as const,
    ...(authError ? { code: 'MODEL_AUTH_FAILED' as const } : {}),
    message,
  };
  res.write(JSON.stringify(errorEvent) + '\n');
}

function isProviderAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('incorrect api key') ||
    lower.includes('invalid api key') ||
    lower.includes('authentication') ||
    lower.includes('unauthorized')
  );
}

function mapResumeApprovalError(error: unknown): never {
  const namedError = error instanceof Error ? error : null;
  if (
    error instanceof ApprovalRequestNotFoundError ||
    namedError?.name === 'ApprovalRequestNotFoundError'
  ) {
    throw new HttpError(404, 'NOT_FOUND', namedError?.message ?? 'Approval request not found');
  }
  if (
    error instanceof ApprovalRequestAlreadyResumedError ||
    namedError?.name === 'ApprovalRequestAlreadyResumedError'
  ) {
    const resumed = error as ApprovalRequestAlreadyResumedError;
    throw new HttpError(
      409,
      'APPROVAL_ALREADY_RESUMED',
      namedError?.message ?? 'Approval request has already been resumed',
      {
        id: resumed.id,
        resumedAtMs: resumed.resumedAtMs,
      },
    );
  }
  if (
    error instanceof ApprovalRequestTransitionError ||
    namedError?.name === 'ApprovalRequestTransitionError'
  ) {
    const transition = error as ApprovalRequestTransitionError;
    throw new HttpError(
      409,
      'INVALID_APPROVAL_TRANSITION',
      namedError?.message ?? 'Invalid approval request transition',
      {
        id: transition.id,
        currentStatus: transition.currentStatus,
        requestedStatus: transition.requestedStatus,
      },
    );
  }
  throw error;
}

function parseExecutionPayload(request: ApprovalRequest): ToolCallIntent {
  if (!request.executionPayloadJson) {
    throw new HttpError(
      409,
      'APPROVAL_RESUME_STATE_MISSING',
      'Approval request has no durable execution payload',
    );
  }

  let parsed: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    mcpBinding?: McpApprovalBinding;
    gitDeliveryBinding?: { operationId: string };
  };
  try {
    parsed = z
      .object({
        toolCallId: z.string().min(1),
        toolName: z.string().min(1),
        args: z.record(z.string(), z.unknown()).default({}),
        gitDeliveryBinding: z.object({ operationId: z.string().uuid() }).strict().optional(),
        mcpBinding: z
          .object({
            serverId: z.string().min(1),
            configurationRevision: z.number().int().nonnegative(),
            toolRevision: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict()
          .optional(),
      })
      .parse(JSON.parse(request.executionPayloadJson));
  } catch {
    throw new HttpError(409, 'APPROVAL_RESUME_STATE_INVALID', 'Approval resume state is invalid');
  }

  if (parsed.toolName !== request.toolName) {
    throw new HttpError(
      409,
      'APPROVAL_RESUME_STATE_MISMATCH',
      'Approval request payload does not match the reviewed tool',
    );
  }

  if (isGitDeliveryTool(parsed.toolName)) {
    try {
      if (!parsed.gitDeliveryBinding || parsed.mcpBinding) throw new Error('Missing Git binding');
      z.object({
        toolCallId: z.string().min(1),
        toolName: z.string().min(1),
        args: z.record(z.string(), z.unknown()),
        gitDeliveryBinding: z.object({ operationId: z.string().uuid() }).strict(),
      })
        .strict()
        .parse(JSON.parse(request.executionPayloadJson));
      parsed.args = parseGitDeliveryToolAction(parsed.toolName, parsed.args);
    } catch {
      throw new HttpError(
        409,
        'APPROVAL_RESUME_STATE_INVALID',
        'Git approval resume state is invalid',
      );
    }
  } else if (parsed.gitDeliveryBinding) {
    throw new HttpError(409, 'APPROVAL_RESUME_STATE_INVALID', 'Unexpected Git approval binding');
  }
  return {
    id: parsed.toolCallId,
    name: parsed.toolName,
    args: parsed.args,
    ...(parsed.mcpBinding ? { mcpBinding: parsed.mcpBinding } : {}),
    ...(parsed.gitDeliveryBinding ? { gitDeliveryBinding: parsed.gitDeliveryBinding } : {}),
  };
}

function approvalContext(
  db: DrizzleDb,
  sessionId: string,
  messages: ChatMessage[],
): {
  approvalToolCallIds: string[];
  pendingApprovalToolCallIds: string[];
} {
  const reviewedIds: string[] = [];
  const approvalToolCallIds: string[] = [];
  const pendingApprovalToolCallIds: string[] = [];
  for (const approval of listApprovalRequests(db, { sessionId, limit: 1000, offset: 0 })) {
    try {
      const reviewed = parseExecutionPayload(approval);
      reviewedIds.push(reviewed.id);
      const matches = messages.flatMap((message) =>
        message.role === 'assistant'
          ? (message.toolCalls ?? []).filter((call) => call.id === reviewed.id)
          : [],
      );
      if (
        matches.length !== 1 ||
        matches[0]?.name !== reviewed.name ||
        !isDeepStrictEqual(matches[0]?.args, reviewed.args)
      )
        continue;
      approvalToolCallIds.push(reviewed.id);
      if (!approval.resumedAtMs) pendingApprovalToolCallIds.push(reviewed.id);
    } catch {
      // Invalid records never authorize omission or execution; admission stays fail-closed.
    }
  }
  const unique = approvalToolCallIds.filter(
    (id) => reviewedIds.indexOf(id) === reviewedIds.lastIndexOf(id),
  );
  return {
    approvalToolCallIds: unique,
    pendingApprovalToolCallIds: pendingApprovalToolCallIds.filter((id) => unique.includes(id)),
  };
}

/** Bind cancellation/execution authority to the freshly claimed persisted row, never model data. */
function assertClaimedGitApproval(
  db: DrizzleDb,
  approval: ApprovalRequest,
  call: ToolCallIntent,
  agentId: string,
): void {
  const current = getSession(db, approval.sessionId);
  const project = current?.projectId ? findProject(db, current.projectId) : undefined;
  const operation = call.gitDeliveryBinding
    ? getGitDeliveryOperation(db, call.gitDeliveryBinding.operationId)
    : undefined;
  const claimedCall = parseExecutionPayload(approval);
  if (
    approval.status !== 'approved' ||
    approval.resumedAtMs === undefined ||
    (approval.expiresAtMs !== undefined && approval.expiresAtMs <= Date.now()) ||
    !current ||
    current.mode !== 'project' ||
    current.agentId !== agentId ||
    approval.agentId !== agentId ||
    !project ||
    project.archivedAtMs ||
    !operation ||
    operation.receipt.source !== 'chat' ||
    operation.receipt.projectId !== project.id ||
    operation.receipt.sessionId !== current.id ||
    operation.agentId !== agentId ||
    operation.toolCallId !== call.id ||
    approval.toolName !== call.name ||
    !isDeepStrictEqual(claimedCall, call) ||
    !isDeepStrictEqual(operation.receipt.action, call.args)
  ) {
    throw new HttpError(
      409,
      'GIT_DELIVERY_APPROVAL_INVALID',
      'Claimed Git approval no longer matches this owned operation.',
    );
  }
}

function buildResumeMessages(
  db: DrizzleDb,
  sessionId: string,
  systemPrompt: string,
  toolCall: ToolCallIntent,
): {
  messages: ChatMessage[];
  reconstructedToolCallContext: boolean;
  currentTurnStartIndex: number;
} {
  const history = loadPrivateHistory(db, sessionId);
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];
  const assistantIndex = messages.findIndex(
    (message) =>
      message.role === 'assistant' && message.toolCalls?.some((call) => call.id === toolCall.id),
  );
  const reconstructedToolCallContext = assistantIndex < 0;
  const turnEnd = reconstructedToolCallContext ? messages.length : assistantIndex;
  let currentTurnStartIndex = -1;
  for (let index = turnEnd - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') {
      currentTurnStartIndex = index;
      break;
    }
  }
  if (reconstructedToolCallContext) {
    messages.push({ id: randomUUID(), role: 'assistant', content: '', toolCalls: [toolCall] });
  }
  return { messages, reconstructedToolCallContext, currentTurnStartIndex };
}

function buildRejectedToolMessage(toolCall: ToolCallIntent, request: ApprovalRequest): ChatMessage {
  return {
    role: 'tool',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: JSON.stringify({
      error: 'APPROVAL_REJECTED',
      message: request.decisionReason
        ? `Human rejected tool execution: ${request.decisionReason}`
        : 'Human rejected tool execution.',
    }),
  };
}

/** A transcript observation only; never an effect receipt or proof that admitted work ended. */
function interruptedApprovalMessage(
  toolCall: ToolCallIntent,
  approval: ApprovalRequest,
): ChatMessage {
  return approval.status === 'rejected'
    ? buildRejectedToolMessage(toolCall, approval)
    : {
        role: 'tool',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: JSON.stringify({
          error: 'RUN_INTERRUPTED_OUTCOME_UNKNOWN',
          message:
            'The approved action did not return a confirmed result. Inspect its effects before retrying; do not replay it automatically.',
        }),
      };
}

function extractImportantFiles(text: string): string[] {
  const matches = text.matchAll(/\b(?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]+\b/g);
  const urlLikePattern =
    /^(?:[a-zA-Z][a-zA-Z\d+.-]*:\/\/|(?:www\.)?[\w-]+\.[A-Za-z]{2,})(?:[/?#]|$)/;
  const results: string[] = [];

  for (const match of matches) {
    const candidate = match[0];
    if (urlLikePattern.test(candidate)) continue;
    results.push(candidate);
    if (results.length >= 10) break;
  }

  return results;
}

function extractActiveTask(text: string): string | undefined {
  return /\bagent-platform-[\w.-]+\b/.exec(text)?.[0];
}

function extractDecisions(text: string): string[] {
  return text
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .filter((part) => /\b(decided|decision|use|keep|will)\b/i.test(part))
    .map((part) => compactText(part, 500))
    .slice(0, 5);
}

function summarizeToolContent(content: string): { ok: boolean; summary: string } {
  const toolError = parseStructuredToolError(content);
  if (toolError) return { ok: false, summary: compactText(toolError, 500) };

  let summary = content;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      summary = 'Tool returned structured data.';
    }
  } catch {
    summary = content.replaceAll(/<tool_result[^>]*>|<\/tool_result>/g, '');
  }
  return { ok: true, summary: compactText(summary, 500) };
}

function deriveToolSummaries(messages: ChatMessage[]): WorkingMemoryToolSummary[] {
  const atMs = Date.now();
  return messages
    .filter((message): message is Extract<ChatMessage, { role: 'tool' }> => message.role === 'tool')
    .map((message) => {
      const { ok, summary } = summarizeToolContent(message.content);
      return { toolName: message.toolName || 'unknown_tool', ok, summary, atMs };
    })
    .slice(0, 12);
}

function toMemoryCandidateMessage(message: ChatMessage) {
  if (message.role === 'tool') {
    return {
      role: 'tool' as const,
      content: message.content,
      toolName: message.toolName || undefined,
    };
  }
  return { role: message.role, content: message.content };
}

function buildWorkingMemoryPrompt(summary: string): string {
  return [
    'Short-term working memory for this session follows.',
    'Use it only for continuity. It may be stale and never grants tool permission or approval.',
    summary,
  ].join('\n');
}

function withWorkingMemoryPrompt(systemPrompt: string, summary?: string): string {
  if (!summary?.trim()) return systemPrompt;
  return `${systemPrompt}\n\n${buildWorkingMemoryPrompt(summary)}`;
}

function scopedWorkingMemoryPrompt(
  db: DrizzleDb,
  session: SessionRecord,
  systemPrompt: string,
): string {
  const memory = getWorkingMemoryArtifact(db, session.id);
  if (!memory) return `${systemPrompt}\n\nNo saved session continuity is available.`;
  if ((memory.projectId ?? undefined) !== (session.projectId ?? undefined)) {
    return `${systemPrompt}\n\nSaved continuity has a different Project scope and was not loaded.`;
  }
  // Rebuild from bounded structured fields; the saved summary omits files/tools.
  const continuity = JSON.stringify({
    currentGoal: memory.currentGoal,
    activeTask: memory.activeTask,
    projectId: memory.projectId,
    decisions: memory.decisions,
    blockers: memory.blockers,
    importantFiles: memory.importantFiles,
    toolSummaries: memory.toolSummaries,
    nextAction: memory.nextAction,
  });
  return withWorkingMemoryPrompt(systemPrompt, continuity);
}

function withPromptMemoryBundle(systemPrompt: string, bundle: PromptMemoryBundle): string {
  const prompt = formatPromptMemoryBundle(bundle);
  if (!prompt) return systemPrompt;
  return `${systemPrompt}\n\n${prompt}`;
}

function refreshWorkingMemory({
  db,
  sessionId,
  agentId,
  runId,
  userMessage,
  newMessages,
}: {
  db: DrizzleDb;
  sessionId: string;
  agentId: string;
  runId: string;
  userMessage: string;
  newMessages: ChatMessage[];
}) {
  const visibleText = [userMessage, ...newMessages.map((message) => message.content)].join('\n');
  const toolSummaries = deriveToolSummaries(newMessages);
  const pendingApprovals = listApprovalRequests(db, {
    sessionId,
    status: 'pending',
    limit: 20,
    offset: 0,
  });
  const assistantText = [...newMessages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content.trim())?.content;
  const blockers = pendingApprovals.map(
    (approval) => `Pending approval for ${approval.toolName} (${approval.id})`,
  );
  const toolsUsed = toolSummaries.map((summary) => summary.toolName);
  const session = getSession(db, sessionId);
  const projectId = session?.projectId;
  const existing = getWorkingMemoryArtifact(db, sessionId);
  // The repository upsert merges old fields. Never relabel continuity from a
  // different Project as current-session evidence; leave it disclosed/unloaded.
  if (existing && (existing.projectId ?? undefined) !== (projectId ?? undefined)) return;

  upsertWorkingMemoryArtifact(db, {
    sessionId,
    runId,
    currentGoal: compactText(userMessage, 500),
    projectId: projectId ?? undefined,
    activeTask: extractActiveTask(visibleText),
    decisions: extractDecisions(visibleText),
    importantFiles: extractImportantFiles(visibleText),
    toolsUsed,
    toolSummaries,
    blockers,
    pendingApprovalIds: pendingApprovals.map((approval) => approval.id),
    nextAction: assistantText ? compactText(assistantText, 500) : 'Continue the session.',
  });

  createMemoryCandidates(db, {
    sessionId,
    agentId,
    projectId: projectId ?? undefined,
    messages: [
      { role: 'user', content: userMessage },
      ...newMessages.map((message) => toMemoryCandidateMessage(message)),
    ],
  });
}

function createAuditLog(db: DrizzleDb): ReturnType<typeof createToolAuditLogger> {
  const observations = new Map<string, (status: string, durationMs: number) => void>();
  const auditStore: ToolAuditStore = {
    insert: (entry) => {
      insertToolExecution(db, entry);
      if (observations.size < 256)
        observations.set(entry.id, observeDiagnosticTool(entry.id, entry.toolName, entry.status));
    },
    complete: (id, data) => {
      completeToolExecution(db, id, data);
      observations.get(id)?.(data.status, data.durationMs);
      observations.delete(id);
    },
  };
  return createToolAuditLogger(auditStore);
}

function resolveSessionProjectPath(db: DrizzleDb, sessionId: string): string | undefined {
  const session = getSession(db, sessionId);
  const workingMemory = getWorkingMemoryArtifact(db, sessionId);
  const projectId = session?.projectId ?? workingMemory?.projectId;
  if (projectId) {
    const project = findProject(db, projectId);
    if (project) return project.workspacePath;
  }
  return workingMemory?.activeProject;
}

function resolveSessionProjectContext(
  db: DrizzleDb,
  session: SessionRecord,
): SessionProjectContext {
  const projectId = session.projectId;
  if (!projectId) return {};

  const project = findProject(db, projectId);
  return project ? { projectId: project.id, project } : { projectId };
}

function resolveRuntimeWorkspace(
  db: DrizzleDb,
  sessionId: string,
): ProjectWorkspaceResolution | undefined {
  const session = getSession(db, sessionId);
  if (!session?.projectId) return undefined;
  return resolveSessionWorkspace(db, sessionId);
}

function unavailableProjectToolExecutor(
  resolution: Extract<ProjectWorkspaceResolution, { ok: false }>,
): NativeToolExecutor {
  return async (): Promise<Output> => ({
    type: 'error',
    code: resolution.code,
    message: resolution.message,
  });
}

function replaceWorkspacePathFragments(value: string, workspaceRoot: string): string {
  const direct = value.split(workspaceRoot).join('/workspace');
  if (sep === '/') return direct;
  return direct.split(workspaceRoot.split(sep).join('/')).join('/workspace');
}

function mapProjectWorkspacePaths(value: unknown, workspaceRoot: string): unknown {
  if (typeof value === 'string') {
    const rel = relative(workspaceRoot, value);
    if (rel === '') return '/workspace';
    if (!rel.startsWith('..') && !isAbsolute(rel)) {
      return `/workspace/${rel.split(sep).join('/')}`;
    }
    return replaceWorkspacePathFragments(value, workspaceRoot);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => mapProjectWorkspacePaths(entry, workspaceRoot));
  }
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      mapProjectWorkspacePaths(entry, workspaceRoot),
    ]),
  );
}

function sanitizeProjectFacingText(value: string): string {
  return value
    .replace(/\/workspace\/([^\s`"')\]},]+)/g, '$1')
    .replace(/\/workspace\b/g, 'the Project root');
}

function sanitizeProjectFacingOutput(event: Output): Output {
  if (event.type === 'text') {
    return { ...event, content: sanitizeProjectFacingText(event.content) };
  }
  if (event.type === 'error') {
    return { ...event, message: sanitizeProjectFacingText(event.message) };
  }
  return event;
}

function projectUserFacingEmitter(
  emitter: OutputEmitter,
  projectContext: SessionProjectContext,
): OutputEmitter {
  if (!projectContext.project) return emitter;
  return {
    emit(event) {
      return emitter.emit(sanitizeProjectFacingOutput(event));
    },
    end() {
      emitter.end();
    },
  };
}

function sanitizeProjectAssistantMessages(
  messages: ChatMessage[],
  projectContext: SessionProjectContext,
): ChatMessage[];
function sanitizeProjectAssistantMessages(
  messages: ChatMessage[] | undefined,
  projectContext: SessionProjectContext,
): ChatMessage[] | undefined;
function sanitizeProjectAssistantMessages(
  messages: ChatMessage[] | undefined,
  projectContext: SessionProjectContext,
): ChatMessage[] | undefined {
  if (!projectContext.project || !messages) return messages;
  return messages.map((message) =>
    message.role === 'assistant'
      ? { ...message, content: sanitizeProjectFacingText(message.content) }
      : message,
  );
}

function projectWorkspaceOutputExecutor(
  executor: NativeToolExecutor,
  workspaceResolution: ProjectWorkspaceResolution | undefined,
): NativeToolExecutor {
  if (!workspaceResolution?.ok) return executor;
  return async (toolId, args, executionOptions) =>
    mapProjectWorkspacePaths(
      await executor(toolId, args, executionOptions),
      workspaceResolution.workspaceRoot,
    ) as Output;
}

function createRuntimeNativeToolExecutor({
  db,
  agentCtx,
  runId,
  sessionId,
  options,
}: {
  db: DrizzleDb;
  agentCtx: AgentContext;
  runId: string;
  sessionId: string;
  options: ChatRouterOptions;
}): NativeToolExecutor {
  const workspaceResolution = resolveRuntimeWorkspace(db, sessionId);
  if (workspaceResolution && !workspaceResolution.ok) {
    return unavailableProjectToolExecutor(workspaceResolution);
  }
  const defaultRepoPath = workspaceResolution?.ok
    ? workspaceResolution.defaultRepoPath
    : resolveSessionProjectPath(db, sessionId);
  const workspaceRoot = workspaceResolution?.ok ? workspaceResolution.workspaceRoot : undefined;
  const pathJail = workspaceResolution?.ok ? new PathJail(workspaceResolution.mounts) : undefined;
  const factoryExecutor = options.systemToolExecutorFactory?.({
    sessionId,
    runId,
    agentId: agentCtx.agent.id,
    defaultRepoPath,
  });
  if (factoryExecutor) {
    return projectWorkspaceOutputExecutor(factoryExecutor, workspaceResolution);
  }

  return projectWorkspaceOutputExecutor(
    createSystemToolExecutor(
      options.observabilityStore
        ? {
            observability: {
              store: options.observabilityStore,
              sessionId,
              traceId: runId,
            },
            gitDelivery: createGitDeliveryService(db).chat({
              sessionId,
              agentId: agentCtx.agent.id,
            }),
            memory: { db, sessionId, agentId: agentCtx.agent.id },
            defaultRepoPath,
            workspaceRoot,
            pathJail,
          }
        : {
            gitDelivery: createGitDeliveryService(db).chat({
              sessionId,
              agentId: agentCtx.agent.id,
            }),
            memory: { db, sessionId, agentId: agentCtx.agent.id },
            defaultRepoPath,
            workspaceRoot,
            pathJail,
          },
    ),
    workspaceResolution,
  );
}

function createRuntimeToolDispatchNode({
  db,
  agentCtx,
  runId,
  sessionId,
  emitter,
  options,
  approvedToolCallIds,
  nativeToolExecutor,
  gitDeliveryApproval,
}: {
  db: DrizzleDb;
  agentCtx: AgentContext;
  runId: string;
  sessionId: string;
  emitter: OutputEmitter;
  options: ChatRouterOptions;
  approvedToolCallIds?: ReadonlySet<string>;
  nativeToolExecutor?: NativeToolExecutor;
  gitDeliveryApproval?: { toolCallId: string; operationId: string; approvalRequestId: string };
}) {
  const resolvedNativeToolExecutor =
    nativeToolExecutor ??
    createRuntimeNativeToolExecutor({ db, agentCtx, runId, sessionId, options });
  const workspaceResolution = resolveRuntimeWorkspace(db, sessionId);
  const mounts = workspaceResolution?.ok ? workspaceResolution.mounts : DEFAULT_MOUNTS;
  const projectAccessPolicy = workspaceResolution?.ok
    ? workspaceResolution.accessPolicy
    : undefined;
  const workspaceResources = workspaceResolution?.ok
    ? { projectId: workspaceResolution.projectId }
    : undefined;

  const node = observeDiagnosticNode(
    'tool',
    createToolDispatchNode({
      agent: agentCtx.agent,
      tools: agentCtx.tools,
      mcpManager: agentCtx.mcpManager,
      mcpApprovalBindings: agentCtx.mcpApprovalBindings,
      isMcpBindingCurrent: agentCtx.isMcpBindingCurrent,
      nativeToolExecutor: resolvedNativeToolExecutor,
      emitter,
      dispatcher: agentCtx.pluginDispatcher,
      pathJail: new PathJail(mounts),
      auditLog: createAuditLog(db),
      approvalRequests: {
        create: (request) => {
          const record = createApprovalRequest(db, { id: randomUUID(), ...request });
          getRunControlService(db, observeDiagnosticRunControl).pause(request.runId);
          observeDiagnosticApproval(record.id, 'waiting');
          return record;
        },
      },
      approvedToolCallIds,
      gitDelivery: createGitDeliveryService(db).chat({ sessionId, agentId: agentCtx.agent.id }),
      gitDeliveryApproval,
      skillResolver: (id: string) => getSkill(db, id),
      projectAccessPolicy,
      workspaceResources,
      projectWriteBlockHandler: createProjectWriteBlockHandler(db, sessionId),
      executionPolicy: loadSettings(db).executionPolicy,
    }),
  );
  return async (...args: Parameters<typeof node>) => {
    const result = await node(...args);
    return {
      ...result,
      messages: result.messages?.map((message) => ({ ...message, id: message.id ?? randomUUID() })),
    };
  };
}

function projectAccessPolicyForSession(
  db: DrizzleDb,
  sessionId: string,
): ProjectAccessPolicy | undefined {
  const resolution = resolveRuntimeWorkspace(db, sessionId);
  return resolution?.ok ? resolution.accessPolicy : undefined;
}

function createProjectWriteBlockHandler(
  db: DrizzleDb,
  sessionId: string,
): ((input: { reason: string }) => Promise<{ message: string } | undefined>) | undefined {
  const session = getSession(db, sessionId);
  if (!session?.projectId) return undefined;

  return async ({ reason }) => {
    if (reason !== 'onboarding_not_approved') return undefined;
    const project = startProjectOnboardingDraft(db, session.projectId!);
    return { message: formatInitDraftMessage(project.metadata['onboardingDraft']) };
  };
}

function buildRuntimeGraph({
  db,
  agentCtx,
  runId,
  sessionId,
  emitter,
  options,
  approvedToolCallIds,
  nativeToolExecutor,
  onMessagesPersisted,
}: RuntimeGraphInput) {
  const dispatcher = agentCtx.pluginDispatcher;
  return buildHarnessGraph({
    executeTool: async () => ({ ok: true }),
    llmReasonNode: observeDiagnosticNode(
      'model',
      options.llmReasonNode ??
        createLlmReasonNode({
          emitter,
          dispatcher,
          onContextDecision: observeDiagnosticContextDecision,
          onModelAttempt: observeDiagnosticModelAttempt,
          hydrateMessages: (messages) =>
            new Promise<ChatMessage[]>((resolve) => {
              // Preserve settled tool outcomes before the next model can fail or be stopped.
              const context = resolveSessionProjectContext(db, getSession(db, sessionId)!);
              persistNewMessages(
                db,
                sessionId,
                sanitizeProjectAssistantMessages(messages, context),
                0,
              );
              onMessagesPersisted?.();
              resolve(rehydrateContinuation(db, sessionId, messages));
            }),
          onAssistantMessage: (message, previousMessages) =>
            new Promise<void>((resolve) => {
              const context = resolveSessionProjectContext(db, getSession(db, sessionId)!);
              persistNewMessages(
                db,
                sessionId,
                sanitizeProjectAssistantMessages([...previousMessages, message], context),
                0,
              );
              onMessagesPersisted?.();
              resolve();
            }),
        }),
      { deferModelStart: !options.llmReasonNode },
    ),
    toolDispatchNode: createRuntimeToolDispatchNode({
      db,
      agentCtx,
      runId,
      sessionId,
      emitter,
      options,
      approvedToolCallIds,
      nativeToolExecutor,
    }),
    sensorCheckNode: createSensorCheckNode({
      emitter,
      ...(options.observabilityStore
        ? {
            observability: {
              store: options.observabilityStore,
              sessionId,
              traceId: runId,
            },
          }
        : {}),
    }),
    // Keep evaluator nodes out of the user-facing chat runtime for now. The
    // DoD proposer/checker use JSON-only internal prompts, and the critic makes
    // a second model call; both can surface internal evaluator output or errors
    // instead of a normal assistant response when they fail.
    criticNode: undefined,
    dodProposeNode: undefined,
    dodCheckNode: undefined,
    dispatcher,
  });
}

async function emitRuntimeFailure(
  agentCtx: AgentContext,
  sessionId: string,
  runId: string,
  signal: AbortSignal,
  res: Response,
  err: unknown,
  unknown = false,
) {
  failDiagnosticRun(signal, unknown);
  await safePluginCall(() =>
    agentCtx.pluginDispatcher.onTaskEnd({
      sessionId,
      runId,
      taskId: runId,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    }),
  );
  await safePluginCall(() =>
    agentCtx.pluginDispatcher.onError({
      sessionId,
      runId,
      phase: signal.aborted && signal.reason === 'timeout' ? 'session' : 'unknown',
      error: err,
    }),
  );
  emitStreamError(res, err, signal);
}

async function emitTaskStart(agentCtx: AgentContext, sessionId: string, runId: string) {
  await safePluginCall(() =>
    agentCtx.pluginDispatcher.onTaskStart({
      sessionId,
      runId,
      planId: runId,
      taskId: runId,
      toolIds: agentCtx.tools.map((tool) => tool.id),
    }),
  );
}

function startRuntimeResponse(
  res: Response,
  controller: AbortController,
  timeoutMs: number,
): {
  timeoutId: ReturnType<typeof setTimeout>;
  heartbeatId: ReturnType<typeof setInterval>;
} {
  prepareNdjsonResponse(res);
  res.once('close', () => {
    if (!res.writableFinished) controller.abort('client_disconnect');
  });
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const heartbeatId = setInterval(() => {
    if (!res.writableEnded) res.write('\n');
  }, 15_000);
  return { timeoutId, heartbeatId };
}

async function closeRuntimeStream({
  timeoutId,
  heartbeatId,
  release,
  agentCtx,
  res,
}: {
  timeoutId?: ReturnType<typeof setTimeout>;
  heartbeatId?: ReturnType<typeof setInterval>;
  release: () => void;
  agentCtx: AgentContext;
  res: Response;
}) {
  if (timeoutId) clearTimeout(timeoutId);
  if (heartbeatId) clearInterval(heartbeatId);
  release();
  await destroyAgentContext(agentCtx);
  if (!res.writableEnded) res.end();
}

function assertCurrentMcpApproval(db: DrizzleDb, agentId: string, call: ToolCallIntent): void {
  const parsed = parseToolId(call.name);
  if (parsed.kind !== 'mcp') return;
  const binding = call.mcpBinding;
  const server = getMcpServer(db, parsed.mcpServerId);
  const agent = loadAgentById(db, agentId);
  if (
    !binding ||
    binding.serverId !== parsed.mcpServerId ||
    !server ||
    server.needsReconfiguration ||
    server.configurationRevision !== binding.configurationRevision ||
    !agent?.allowedMcpServerIds.includes(parsed.mcpServerId)
  ) {
    throw new HttpError(
      409,
      'MCP_APPROVAL_STALE',
      'MCP connection or assignment changed. Start a new request and review its permissions.',
    );
  }
}

function claimResumedApproval(
  db: DrizzleDb,
  approvalRequestId: string,
  toolCall: ToolCallIntent,
  agentId: string,
  res: Response,
): ApprovalRequest | undefined {
  let approval: ApprovalRequest;
  try {
    approval = claimApprovalRequestForResume(db, approvalRequestId, Date.now());
  } catch (error) {
    mapResumeApprovalError(error);
  }
  if (isGitDeliveryTool(toolCall.name) && approval.status !== 'rejected') {
    try {
      assertClaimedGitApproval(db, approval, toolCall, agentId);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      // Finish the pre-stream refusal before shared stream cleanup ends the response.
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return undefined;
    }
  }
  return approval;
}

async function dispatchResumedApproval({
  db,
  options,
  agentCtx,
  modelCfg,
  runId,
  sessionId,
  emitter,
  signal,
  approval,
  toolCall,
  messages,
  resumeBuild,
  approvalHistory,
  execution,
}: {
  db: DrizzleDb;
  options: ChatRouterOptions;
  agentCtx: AgentContext;
  modelCfg: Awaited<ReturnType<typeof acquireRuntimeContext>>['modelCfg'];
  runId: string;
  sessionId: string;
  emitter: OutputEmitter;
  signal: AbortSignal;
  approval: ApprovalRequest;
  toolCall: ToolCallIntent;
  messages: ChatMessage[];
  resumeBuild: ReturnType<typeof buildResumeMessages>;
  approvalHistory: ReturnType<typeof approvalContext>;
  execution: ControlledExecution;
}) {
  let resumeMessages: ChatMessage[];
  let stopAfterDispatch = false;
  let mcpHalt: HarnessStateType['mcpHalt'];
  let nativeToolExecutor: NativeToolExecutor | undefined;
  if (approval.status === 'rejected') {
    resumeMessages = [buildRejectedToolMessage(toolCall, approval)];
    await emitter.emit({
      type: 'error',
      code: 'APPROVAL_REJECTED',
      message: 'Human rejected tool execution.',
    });
    createAuditLog(db).logRejectedApproval(
      toolCall.name,
      toolCall.args,
      agentCtx.agent.id,
      sessionId,
      'Human rejected tool execution.',
      approval.riskTier,
    );
  } else {
    nativeToolExecutor = createRuntimeNativeToolExecutor({
      db,
      agentCtx,
      runId,
      sessionId,
      options,
    });
    const dispatchNode = createRuntimeToolDispatchNode({
      db,
      agentCtx,
      runId,
      sessionId,
      emitter,
      options,
      approvedToolCallIds: new Set([toolCall.id]),
      ...(toolCall.gitDeliveryBinding
        ? {
            gitDeliveryApproval: {
              toolCallId: toolCall.id,
              operationId: toolCall.gitDeliveryBinding.operationId,
              approvalRequestId: approval.id,
            },
          }
        : {}),
      nativeToolExecutor,
    });
    const dispatchState = buildInitialState(runId, sessionId, messages, agentCtx, modelCfg, {
      currentTurnStartIndex: resumeBuild.currentTurnStartIndex,
      ...approvalHistory,
      projectAccessPolicy: projectAccessPolicyForSession(db, sessionId),
    });
    dispatchState.llmOutput = { kind: 'tool_calls', calls: [toolCall] };
    const dispatchResult = await dispatchNode(dispatchState, {
      configurable: { thread_id: sessionId, signal, runControl: execution },
    });
    resumeMessages = dispatchResult.messages ?? [];
    stopAfterDispatch = dispatchResult.halted === true;
    mcpHalt = dispatchResult.mcpHalt;
  }

  return { resumeMessages, stopAfterDispatch, mcpHalt, nativeToolExecutor };
}

function loadResumableApproval({
  db,
  session,
  approvalRequestId,
  res,
}: {
  db: DrizzleDb;
  session: SessionRecord;
  approvalRequestId: string;
  res: Response;
}) {
  let approval: ApprovalRequest;
  try {
    approval = getApprovalRequest(db, approvalRequestId);
  } catch (error) {
    mapResumeApprovalError(error);
  }

  if (approval.sessionId !== session.id) {
    throw new HttpError(404, 'NOT_FOUND', 'Approval request not found for session');
  }

  if (approval.resumedAtMs) {
    res.json({ data: approval });
    return;
  }

  // Refuse a premature or expired resume before changing its logical run's authority.
  if (!['approved', 'rejected'].includes(approval.status))
    throw new HttpError(
      409,
      'APPROVAL_NOT_DECIDED',
      'Decide the approval before resuming this run.',
    );
  if (approval.expiresAtMs !== undefined && approval.expiresAtMs <= Date.now())
    throw new HttpError(409, 'APPROVAL_EXPIRED', 'The approval expired. Start a new request.');

  const toolCall = parseExecutionPayload(approval);
  // Reject substituted commands/endpoints before opening a replacement connection.
  if (approval.status !== 'rejected') assertCurrentMcpApproval(db, session.agentId, toolCall);

  return { approval, toolCall };
}

type ResumedTranscript = { messages: ChatMessage[]; initialCount: number };

function preserveInterruptedApprovalPairing(
  signal: AbortSignal,
  messages: ChatMessage[],
  toolCall: ToolCallIntent,
  approval: ApprovalRequest,
): void {
  if (
    signal.aborted &&
    !messages.some((message) => message.role === 'tool' && message.toolCallId === toolCall.id)
  )
    messages.push(interruptedApprovalMessage(toolCall, approval));
}

async function handleResumeFailure({
  db,
  sessionId,
  runId,
  approval,
  toolCall,
  agentCtx,
  execution,
  signal,
  res,
  err,
  claimedForDispatch,
  dispatchStarted,
  resumedTranscript,
  resumedPrefixPersisted,
  captured,
}: {
  db: DrizzleDb;
  sessionId: string;
  runId: string;
  approval: ApprovalRequest;
  toolCall: ToolCallIntent;
  agentCtx: AgentContext;
  execution: ControlledExecution;
  signal: AbortSignal;
  res: Response;
  err: unknown;
  claimedForDispatch: boolean;
  dispatchStarted: boolean;
  resumedTranscript?: ResumedTranscript;
  resumedPrefixPersisted: boolean;
  captured?: ReturnType<typeof captureInterruptedReply>;
}): Promise<void> {
  if (claimedForDispatch && !dispatchStarted && isGitDeliveryTool(toolCall.name)) {
    try {
      // The hook may still settle later, but no dispatch owned this prepared operation.
      // Recheck the claimed actor/binding; never cancel a foreign or already entered effect.
      assertClaimedGitApproval(db, approval, toolCall, agentCtx.agent.id);
      await createGitDeliveryService(db)
        .chat({ sessionId, agentId: agentCtx.agent.id })
        .cancel(toolCall.gitDeliveryBinding!.operationId, 'cancelled');
    } catch {
      // A changed actor or unavailable store retains preparation for inspection/expiry.
    }
  }
  if (!res.headersSent && err instanceof HttpError) {
    execution.finish('failed', 'execution_failed');
    throw err;
  }
  if (resumedTranscript && !resumedPrefixPersisted) {
    const interruptedTool = interruptedApprovalMessage(toolCall, approval);
    persistNewMessages(
      db,
      sessionId,
      [...resumedTranscript.messages, interruptedTool],
      resumedTranscript.initialCount,
    );
  }
  captured?.save();
  const terminal = signal.aborted
    ? finishControlledResponse(execution, false)
    : execution.finish('failed', 'execution_failed');
  await emitRuntimeFailure(
    agentCtx,
    sessionId,
    runId,
    signal,
    res,
    err,
    terminal.state === 'outcome_unknown',
  );
}

export async function handleSessionResume(
  db: DrizzleDb,
  options: ChatRouterOptions,
  sessionLock: SessionLock,
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = z.string().min(1).parse(req.params['id']);
  const { approvalRequestId } = parseBody(SessionResumeBodySchema, req.body);

  const session = getSession(db, sessionId);
  if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');

  const resumable = loadResumableApproval({ db, session, approvalRequestId, res });
  if (!resumable) return;
  let { approval } = resumable;
  const { toolCall } = resumable;

  const runId = randomUUID();
  const context = await acquireControlledContext({
    db,
    session,
    options,
    req,
    res,
    sessionLock,
    runId,
    sourceExecutionId: approval.runId,
  });
  if (!context) return;
  const { agentCtx, modelCfg, timeoutMs, release, execution, controller, signal } = context;
  let captured: ReturnType<typeof captureInterruptedReply> | undefined;
  let resumedTranscript: ResumedTranscript | undefined;
  let resumedPrefixPersisted = false;
  let claimedForDispatch = false;
  let dispatchStarted = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let heartbeatId: ReturnType<typeof setInterval> | undefined;

  try {
    assertPendingContinuationBinding(
      loadPrivateHistory(db, sessionId),
      modelCfg.continuationBinding,
      toolCall.id,
    );
    const claimed = claimResumedApproval(db, approvalRequestId, toolCall, agentCtx.agent.id, res);
    if (!claimed) {
      execution.finish('failed', 'execution_failed');
      return;
    }
    approval = claimed;
    claimedForDispatch = true;
    const completeDiagnostics = beginDiagnosticRun(sessionId, runId);
    observeDiagnosticApproval(
      approvalRequestId,
      approval.status === 'rejected' ? 'failed' : 'started',
      approval.runId,
    );
    ({ timeoutId, heartbeatId } = startRuntimeResponse(res, controller, timeoutMs));
    captured = captureInterruptedReply(db, sessionId, createNdjsonEmitter(res), signal);
    const emitter = captured.emitter;

    const projectContext = resolveSessionProjectContext(db, session);
    const resumeBuild = buildResumeMessages(
      db,
      sessionId,
      withProjectInstructionPrompt(
        projectContext,
        scopedWorkingMemoryPrompt(db, session, agentCtx.systemPrompt),
        JSON.stringify(toolCall.args),
      ),
      toolCall,
    );
    const messages = resumeBuild.messages;
    const approvalHistory = approvalContext(db, sessionId, messages);
    const initialCount = messages.length - (resumeBuild.reconstructedToolCallContext ? 1 : 0);
    resumedTranscript = { messages, initialCount };
    await execution.waitFor(
      execution.invoke('setup', () => emitTaskStart(agentCtx, sessionId, runId)),
    );

    // Recheck after awaited setup hooks, immediately before dispatch admission.
    const currentModel = resolveModelOrThrow(
      db,
      agentCtx,
      req.header('x-openai-key'),
      req.header('x-model-config-id') || undefined,
    );
    assertPendingContinuationBinding(
      loadPrivateHistory(db, sessionId),
      currentModel.continuationBinding,
      toolCall.id,
    );
    if (!isDeepStrictEqual(currentModel.continuationBinding, modelCfg.continuationBinding))
      throw new Error(
        'MODEL_CONTINUATION_CHANGED: The model configuration changed while approval was pending. Start a new request.',
      );
    dispatchStarted = true;
    const { resumeMessages, stopAfterDispatch, mcpHalt, nativeToolExecutor } =
      await dispatchResumedApproval({
        db,
        options,
        agentCtx,
        modelCfg,
        runId,
        sessionId,
        emitter,
        signal,
        approval,
        toolCall,
        messages,
        resumeBuild,
        approvalHistory,
        execution,
      });

    preserveInterruptedApprovalPairing(signal, resumeMessages, toolCall, approval);

    // A completed approved effect must remain paired in history even if the next model is stopped.
    const resumedPrefix = sanitizeProjectAssistantMessages(
      [...messages, ...resumeMessages],
      projectContext,
    );
    persistNewMessages(db, sessionId, resumedPrefix, initialCount);
    resumedPrefixPersisted = true;
    const persistedPrefixCount = resumedPrefix.length;

    const graph = buildRuntimeGraph({
      db,
      agentCtx,
      runId,
      sessionId,
      emitter,
      options,
      approvedToolCallIds: isGitDeliveryTool(toolCall.name) ? undefined : new Set([toolCall.id]),
      nativeToolExecutor,
      onMessagesPersisted: captured.checkpoint,
    });
    const resumeState = buildInitialState(
      runId,
      sessionId,
      [...messages, ...resumeMessages],
      agentCtx,
      modelCfg,
      {
        currentTurnStartIndex: resumeBuild.currentTurnStartIndex,
        ...approvalHistory,
        projectAccessPolicy: projectAccessPolicyForSession(db, sessionId),
      },
    );

    const finalState: Pick<HarnessStateType, 'messages' | 'contextHalt' | 'mcpHalt'> =
      stopAfterDispatch
        ? { ...resumeState, mcpHalt }
        : await execution.waitFor(
            graph.invoke(resumeState, {
              configurable: { thread_id: sessionId, signal, runControl: execution },
            }),
          );

    const persistedMessages = sanitizeProjectAssistantMessages(
      finalState?.messages,
      projectContext,
    );
    persistNewMessages(db, sessionId, persistedMessages, persistedPrefixCount);
    captured.markSaved();
    refreshWorkingMemory({
      db,
      sessionId,
      agentId: session.agentId,
      runId,
      userMessage: messages[resumeBuild.currentTurnStartIndex]?.content ?? '',
      newMessages: persistedMessages?.slice(initialCount) ?? [],
    });
    const terminal = finishControlledResponse(
      execution,
      listApprovalRequests(db, { sessionId, limit: 1000, offset: 0 }).some(
        (row) =>
          row.runId === runId &&
          row.resumedAtMs === undefined &&
          ['pending', 'approved', 'rejected'].includes(row.status),
      ),
      Boolean(finalState.contextHalt || finalState.mcpHalt),
    );
    if (signal.aborted) failDiagnosticRun(signal, terminal.state === 'outcome_unknown');
    else completeDiagnostics();
    await safePluginCall(() =>
      agentCtx.pluginDispatcher.onTaskEnd({
        sessionId,
        runId,
        taskId: runId,
        ok: !stopAfterDispatch && !finalState.contextHalt && !finalState.mcpHalt,
        ...terminalFailureDetail(finalState),
      }),
    );
  } catch (err) {
    await handleResumeFailure({
      db,
      sessionId,
      runId,
      approval,
      toolCall,
      agentCtx,
      execution,
      signal,
      res,
      err,
      claimedForDispatch,
      dispatchStarted,
      resumedTranscript,
      resumedPrefixPersisted,
      captured,
    });
  } finally {
    await closeRuntimeStream({ timeoutId, heartbeatId, release, agentCtx, res });
  }
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createChatRouter(db: DrizzleDb, options: ChatRouterOptions = {}): Router {
  const router = createRouter();
  const sessionLock = options.sessionLock ?? createInProcessSessionLock();

  // Session-aware agent chat (NDJSON stream of Output events)
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { sessionId, message } = parseBody(ChatBodySchema, req.body);

      const session = getSession(db, sessionId);
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found');

      if (await handleSlashCommandMessage(db, options, sessionLock, session, message, res)) {
        return;
      }

      const runId = randomUUID();
      const context = await acquireControlledContext({
        db,
        session,
        options,
        req,
        res,
        sessionLock,
        runId,
      });
      if (!context) return;
      const { agentCtx, modelCfg, timeoutMs, release, execution, controller, signal } = context;
      let captured: ReturnType<typeof captureInterruptedReply> | undefined;
      const completeDiagnostics = beginDiagnosticRun(sessionId, runId);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let heartbeatId: ReturnType<typeof setInterval> | undefined;

      try {
        await execution.waitFor(
          execution.invoke('setup', () =>
            safePluginCall(() =>
              agentCtx.pluginDispatcher.onSessionStart({
                sessionId,
                agentId: session.agentId,
                agent: agentCtx.agent,
              }),
            ),
          ),
        );

        ({ timeoutId, heartbeatId } = startRuntimeResponse(res, controller, timeoutMs));
        const projectContext = resolveSessionProjectContext(db, session);
        captured = captureInterruptedReply(db, sessionId, createNdjsonEmitter(res), signal);
        const emitter = projectUserFacingEmitter(captured.emitter, projectContext);
        const dispatcher = agentCtx.pluginDispatcher;

        await execution.waitFor(
          execution.invoke('setup', () => emitTaskStart(agentCtx, sessionId, runId)),
        );

        const graph = buildRuntimeGraph({
          db,
          agentCtx,
          runId,
          sessionId,
          emitter,
          options,
          onMessagesPersisted: captured.checkpoint,
        });

        const { messages, currentTurnStartIndex, memoryBundle, approvalHistory } =
          buildConversationMessages(db, session, message, agentCtx.systemPrompt);

        // Auto-generate a human-readable title on first user message
        if (!session.title) {
          updateSessionTitle(db, sessionId, deriveSessionTitle(message));
        }
        const initialState = buildInitialState(runId, sessionId, messages, agentCtx, modelCfg, {
          currentTurnStartIndex,
          ...approvalHistory,
          memoryBundle,
          projectAccessPolicy: projectAccessPolicyForSession(db, sessionId),
        });

        const finalState: Pick<HarnessStateType, 'messages' | 'contextHalt' | 'mcpHalt'> =
          await execution.waitFor(
            graph.invoke(initialState, {
              configurable: { thread_id: sessionId, signal, runControl: execution },
            }),
          );

        const persistedMessages = sanitizeProjectAssistantMessages(
          finalState?.messages,
          projectContext,
        );
        if (options.emitFinalAssistantMessage) {
          await emitFinalAssistantMessage(emitter, persistedMessages, messages.length);
        }
        persistNewMessages(db, sessionId, persistedMessages, messages.length);
        captured.markSaved();
        refreshWorkingMemory({
          db,
          sessionId,
          agentId: session.agentId,
          runId,
          userMessage: message,
          newMessages: persistedMessages?.slice(messages.length) ?? [],
        });
        const terminal = finishControlledResponse(
          execution,
          listApprovalRequests(db, { sessionId, limit: 1000, offset: 0 }).some(
            (row) =>
              row.runId === runId &&
              row.resumedAtMs === undefined &&
              ['pending', 'approved', 'rejected'].includes(row.status),
          ),
          Boolean(finalState.contextHalt || finalState.mcpHalt),
        );
        if (signal.aborted) failDiagnosticRun(signal, terminal.state === 'outcome_unknown');
        else completeDiagnostics();
        await safePluginCall(() =>
          dispatcher.onTaskEnd({
            sessionId,
            runId,
            taskId: runId,
            ok: !finalState.contextHalt && !finalState.mcpHalt,
            ...terminalFailureDetail(finalState),
          }),
        );
      } catch (err) {
        captured?.save();
        const terminal = signal.aborted
          ? finishControlledResponse(execution, false)
          : execution.finish('failed', 'execution_failed');
        await emitRuntimeFailure(
          agentCtx,
          sessionId,
          runId,
          signal,
          res,
          err,
          terminal.state === 'outcome_unknown',
        );
      } finally {
        await closeRuntimeStream({ timeoutId, heartbeatId, release, agentCtx, res });
      }
    }),
  );

  // LEGACY: Raw OpenAI pass-through (deprecated)
  router.post(
    '/stream',
    asyncHandler(async (req, res) => {
      res.setHeader('X-Deprecated', 'Use POST /v1/chat with { sessionId, message } instead');

      const body = parseBody(LegacyChatStreamBodySchema, req.body);
      const gated = resolveGatedOpenAiKeyForRequest({
        preferredEnvVar: 'AGENT_OPENAI_API_KEY',
        headerKey: req.header('x-openai-key'),
      });
      const apiOutcome = openAiKeyGateToApiOutcome(gated);
      if (apiOutcome.kind === 'error') {
        throw new HttpError(400, apiOutcome.code, apiOutcome.message);
      }

      const result = streamChat({
        provider: 'openai',
        apiKey: apiOutcome.key,
        model: body.model,
        messages: body.messages,
      });
      res.status(200);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      try {
        for await (const chunk of result.textStream) {
          if (req.aborted || res.writableEnded) break;
          res.write(chunk);
        }
      } finally {
        if (!res.writableEnded) res.end();
      }
    }),
  );

  return router;
}

async function handleSlashCommandMessage(
  db: DrizzleDb,
  options: ChatRouterOptions,
  sessionLock: SessionLock,
  session: SessionRecord,
  message: string,
  res: Response,
): Promise<boolean> {
  if (!message.trimStart().startsWith('/')) return false;

  const release = await sessionLock.acquire(session.id);
  try {
    const slashCommand = runSlashCommand(
      message,
      {
        session,
        ...resolveSessionProjectContext(db, session),
        startProjectOnboarding: (projectId) => startProjectOnboardingDraft(db, projectId),
      },
      resolveSlashCommandOptions(options.slashCommands),
    );
    if (slashCommand.kind === 'handled') {
      persistSlashCommandMessages(db, session.id, message, slashCommand.message);
      prepareNdjsonResponse(res);
      const emitter: OutputEmitter = createNdjsonEmitter(res);
      await emitter.emit({ type: 'text', content: slashCommand.message });
      if (!res.writableEnded) res.end();
      return true;
    }
    return false;
  } finally {
    release();
  }
}

function persistSlashCommandMessages(
  db: DrizzleDb,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
): void {
  withTransaction(db, (tx) => {
    appendMessage(tx, { sessionId, role: 'user', content: userMessage });
    appendMessage(tx, { sessionId, role: 'assistant', content: assistantMessage });
  });
}

// ---------------------------------------------------------------------------
// State builders (extracted for readability)
// ---------------------------------------------------------------------------

function prepareNdjsonResponse(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

function buildConversationMessages(
  db: DrizzleDb,
  session: SessionRecord,
  newMessage: string,
  systemPrompt: string,
): {
  messages: ChatMessage[];
  currentTurnStartIndex: number;
  memoryBundle: PromptMemoryBundle;
  approvalHistory: ReturnType<typeof approvalContext>;
} {
  return withTransaction(db, (tx) => {
    const sessionId = session.id;
    const history = loadPrivateHistory(tx, sessionId);
    appendMessage(tx, { sessionId, role: 'user', content: newMessage });
    const projectContext = resolveSessionProjectContext(tx, session);
    const memoryBundle = retrievePromptMemories(tx, {
      scope: {
        sessionId,
        agentId: session.agentId,
        projectId: projectContext.projectId,
      },
      query: newMessage,
    });

    const userMsg: ChatMessage = { role: 'user' as const, content: newMessage };
    const effectiveSystemPrompt = withPromptMemoryBundle(
      withProjectInstructionPrompt(
        projectContext,
        scopedWorkingMemoryPrompt(tx, session, systemPrompt),
        newMessage,
      ),
      memoryBundle,
    );

    return {
      messages: [{ role: 'system', content: effectiveSystemPrompt }, ...history, userMsg],
      currentTurnStartIndex: history.length + 1,
      approvalHistory: approvalContext(tx, sessionId, history),
      memoryBundle,
    };
  });
}

function projectScopePath(message: string): string | undefined {
  const file = extractImportantFiles(message).at(0);
  if (!file) return undefined;
  return file.startsWith('/workspace/') ? file.slice('/workspace/'.length) : file;
}

function withProjectInstructionPrompt(
  projectContext: SessionProjectContext,
  systemPrompt: string,
  message: string,
): string {
  const project = projectContext.project;
  const backendProjectRoot = project?.metadata['backendProjectRoot'];
  if (!project || typeof backendProjectRoot !== 'string') return systemPrompt;
  const prompt = buildProjectInstructionPrompt(
    backendProjectRoot,
    parseProjectInstructionFileReferences(project.metadata),
    projectScopePath(message),
  );
  return prompt ? `${systemPrompt}\n\n${prompt}` : systemPrompt;
}

function terminalFailureDetail(state: Pick<HarnessStateType, 'contextHalt' | 'mcpHalt'>): {
  detail?: string;
} {
  const failure = state.contextHalt ?? state.mcpHalt;
  return failure ? { detail: failure.code } : {};
}

function buildInitialState(
  runId: string,
  sessionId: string,
  messages: ChatMessage[],
  agentCtx: AgentContext,
  modelConfig: ResolvedChatModel,
  contextInfo: {
    currentTurnStartIndex: number;
    pendingApprovalToolCallIds?: string[];
    approvalToolCallIds?: string[];
    memoryBundle?: PromptMemoryBundle;
    projectAccessPolicy?: ProjectAccessPolicy;
  },
): HarnessStateType {
  const memoryBundle = contextInfo.memoryBundle;
  const sensorProfile = inferSensorAgentProfile(agentCtx);
  const tools = visibleToolsForProjectPolicy(agentCtx.tools, contextInfo.projectAccessPolicy);
  return {
    trace: [
      ...(memoryBundle
        ? [
            {
              type: 'memory_retrieval' as const,
              included: memoryBundle.includedCount,
              omitted: memoryBundle.omitted,
            },
          ]
        : []),
    ],
    plan: null,
    taskIndex: 0,
    limits: agentCtx.agent.executionLimits,
    runId,
    sessionId,
    halted: false,
    mode: 'react' as const,
    messages,
    contextWindow: agentCtx.agent.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    currentTurnStartIndex: contextInfo.currentTurnStartIndex,
    pendingApprovalToolCallIds: contextInfo.pendingApprovalToolCallIds ?? [],
    approvalToolCallIds: contextInfo.approvalToolCallIds ?? [],
    contextHalt: null,
    mcpHalt: null,
    toolDefinitions: contractToolsToDefinitions(tools),
    llmOutput: null,
    modelConfig,
    stepCount: 0,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    totalToolCalls: 0,
    loadedSkillIds: [],
    totalRetries: 0,
    startedAtMs: Date.now(),
    deadlineMs: agentCtx.agent.executionLimits.timeoutMs,
    iterations: 0,
    critique: undefined,
    dodAttempts: 0,
    dodContract: undefined,
    sensorResults: [],
    sensorAttempts: {},
    sensorLastToolIds: [],
    sensorRequestedTrigger: undefined,
    sensorLastTrigger: undefined,
    sensorAgentProfile: sensorProfile,
    sensorTaskContexts: sensorProfile === 'coding' ? ['repo_change'] : [],
    sensorChangedFiles: [],
    sensorRepoPath: '.',
    sensorFindingCollectorResults: [],
  };
}

function visibleToolsForProjectPolicy(
  tools: ContractTool[],
  policy: ProjectAccessPolicy | undefined,
): ContractTool[] {
  if (!policy) return tools;
  if (policy.canWrite === true && policy.writeBlockReason === undefined) return tools;
  return tools.filter((tool) => !PROJECT_WRITE_TOOL_IDS.has(tool.id));
}

function inferSensorAgentProfile(agentCtx: AgentContext): SensorAgentProfile {
  const agentText = `${agentCtx.agent.slug} ${agentCtx.agent.name} ${agentCtx.agent.description ?? ''}`;
  return /\bcod(e|ing|er)\b|repository|typescript|application code/i.test(agentText)
    ? 'coding'
    : 'personal_assistant';
}
