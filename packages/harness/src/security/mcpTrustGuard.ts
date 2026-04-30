/**
 * MCP Trust Guard — validates tools discovered from MCP servers.
 *
 * Defends against MCP server poisoning:
 * 1. Tool name shadowing — MCP tools must not shadow system tools
 * 2. Description injection — tool descriptions must not contain injection patterns
 * 3. Schema suspicious fields — input schemas must not request sensitive data
 *
 * See docs/planning/security.md — Threat 6: MCP Server Poisoning.
 */

import type { Tool as ContractTool } from '@agent-platform/contracts';
import { SYSTEM_TOOL_IDS } from '../systemTools.js';
import { scanForInjection } from './injectionGuard.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpToolValidationResult {
  /** Tools that passed all validation checks. */
  safe: ContractTool[];
  /** Tools that were rejected with reasons. */
  rejected: { tool: ContractTool; reasons: string[] }[];
}

// ---------------------------------------------------------------------------
// Suspicious schema field names
// ---------------------------------------------------------------------------

const SUSPICIOUS_SCHEMA_FIELDS = new Set([
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'private_key',
  'credentials',
  'auth',
  'authorization',
  'access_token',
  'refresh_token',
  'master_key',
  'passphrase',
]);

// ---------------------------------------------------------------------------
// Known system tool names (non-prefixed) that MCP tools must not shadow
// ---------------------------------------------------------------------------

const SYSTEM_TOOL_NAMES = new Set([
  'bash',
  'read_file',
  'write_file',
  'list_files',
  'append_file',
  'copy_file',
  'file_exists',
  'file_info',
  'find_files',
  'git_status',
  'git_diff',
  'git_log',
  'git_branch_info',
  'git_changed_files',
  'create_directory',
  'http_request',
  'download_file',
  'coding_apply_patch',
  'run_command',
  'execute',
  'delete_file',
]);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function checkNameShadowing(tool: ContractTool): string | null {
  // Check against full system tool IDs (sys_ prefixed)
  if (SYSTEM_TOOL_IDS.has(tool.id)) {
    return `Tool ID "${tool.id}" shadows a system tool`;
  }
  // Check tool name against known system tool names
  if (SYSTEM_TOOL_NAMES.has(tool.name)) {
    return `Tool name "${tool.name}" shadows a system tool`;
  }
  return null;
}

function checkDescriptionInjection(tool: ContractTool): string | null {
  if (!tool.description) return null;

  const scan = scanForInjection(tool.description);
  if (scan.suspicious) {
    return `Tool description contains suspicious injection patterns: ${scan.patterns.join(', ')}`;
  }
  return null;
}

function scanSchemaFields(schema: unknown): string[] {
  if (!schema || typeof schema !== 'object') return [];

  const schemaStr = JSON.stringify(schema).toLowerCase();
  return [...SUSPICIOUS_SCHEMA_FIELDS].filter((field) => schemaStr.includes(`"${field}"`));
}

function checkSuspiciousSchema(tool: ContractTool): string | null {
  const inputSchema = tool.config?.inputSchema;
  if (!inputSchema) return null;

  const suspicious = scanSchemaFields(inputSchema);
  if (suspicious.length > 0) {
    return `Tool input schema contains suspicious field names: ${suspicious.join(', ')}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate an array of MCP-discovered tools, filtering out any that fail
 * security checks. Returns both safe tools and rejected tools with reasons.
 */
export function validateMcpTools(
  _mcpServerId: string,
  tools: ContractTool[],
): McpToolValidationResult {
  const safe: ContractTool[] = [];
  const rejected: McpToolValidationResult['rejected'] = [];

  for (const tool of tools) {
    const reasons: string[] = [];

    const shadowReason = checkNameShadowing(tool);
    if (shadowReason) reasons.push(shadowReason);

    const injectionReason = checkDescriptionInjection(tool);
    if (injectionReason) reasons.push(injectionReason);

    const schemaReason = checkSuspiciousSchema(tool);
    if (schemaReason) reasons.push(schemaReason);

    if (reasons.length > 0) {
      rejected.push({ tool, reasons });
    } else {
      safe.push(tool);
    }
  }

  return { safe, rejected };
}
