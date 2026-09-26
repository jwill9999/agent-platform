import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_ROLE_OPERATION_POLICY } from './authorization.js';
import { workflowRoleSchema, workflowOperationSchema } from './contracts.js';
import { modelGatewayConfigSchema } from './modelGatewayConfig.js';

export function specialistRoleProfile(roleInput: string, operationsInput: readonly string[]) {
  const role = workflowRoleSchema.parse(roleInput);
  if (role === 'workflow_orchestrator') throw new Error('coordinator cannot launch as specialist');
  const operations = operationsInput.map((o) => workflowOperationSchema.parse(o));
  if (operations.some((o) => !DEFAULT_ROLE_OPERATION_POLICY[role].includes(o)))
    throw new Error('specialist operations exceed role policy');
  if (!operations.includes('workspace.read')) throw new Error('specialist requires workspace.read');
  return {
    role,
    patch: role === 'implementation_worker' && operations.includes('workspace.patch'),
    test: operations.includes('process.test'),
    artifacts: operations.includes('artifact.write'),
  };
}
export type SpecialistRoleProfile = ReturnType<typeof specialistRoleProfile>;
export interface SpecialistModelConnection {
  url: string;
  model?: string;
}

export function specialistWorkingDirectory(profile: SpecialistRoleProfile) {
  if (profile.patch) return '/workspace';
  if (profile.test) return '/scratch';
  if (profile.artifacts) return '/evidence';
  return '/workspace';
}

/** Entire configuration is generated; no inherited MCP or arbitrary provider/feature tables. */
export function specialistRoleConfig(
  profile: SpecialistRoleProfile,
  connection?: SpecialistModelConnection,
) {
  const execute = profile.patch || profile.test || profile.artifacts;
  const disabled = [
    'apps',
    'browser_use',
    'browser_use_external',
    'computer_use',
    'in_app_browser',
    'browser_use_full_cdp_access',
    'plugins',
    'remote_plugin',
    'skill_search',
    'skill_mcp_dependency_install',
    'multi_agent',
    'multi_agent_v2',
    'goals',
    'image_generation',
    'view_image',
    'sleep_tool',
  ];
  let config =
    'approval_policy = "never"\nsandbox_mode = "' +
    (execute ? 'workspace-write' : 'read-only') +
    '"\nweb_search = "disabled"\n';
  if (connection) {
    modelGatewayConfigSchema.parse({ ...connection, model: connection.model ?? 'validation-only' });
    if (connection.model) config += `model = ${JSON.stringify(connection.model)}\n`;
    config += 'model_provider = "role_gateway"\n';
  }
  config += '[agents]\nenabled = false\nmax_depth = 0\n[features]\n';
  config += disabled.map((k) => `${k} = false\n`).join('');
  config += `shell_tool = ${profile.test}\nunified_exec = ${profile.test}\ncode_mode = ${execute}\ncode_mode_host = ${execute}\n`;
  config += '[mcp_servers]\n';
  if (execute) {
    const roots = [
      ...(profile.test ? ['/scratch'] : []),
      ...(profile.artifacts ? ['/evidence'] : []),
    ];
    config += `[sandbox_workspace_write]\nnetwork_access = false\nwritable_roots = ${JSON.stringify(roots)}\n`;
  }
  if (connection)
    config +=
      '[model_providers.role_gateway]\nname="Explicit role model gateway"\nwire_api="responses"\nrequires_openai_auth=true\nsupports_websockets=false\nbase_url=' +
      JSON.stringify(connection.url) +
      '\n';
  return config;
}

/** Bounded source delivery for evidence-only roles; never truncate or decode binary silently. */
export async function collectSpecialistEvidence(root: string) {
  const files: { path: string; sha256: string; content: string }[] = [];
  let bytes = 0;
  const visit = async (directory: string, prefix: string): Promise<void> => {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name),
        info = await lstat(path);
      if (info.isDirectory()) {
        await visit(path, prefix + name + '/');
        continue;
      }
      if (!info.isFile()) throw new Error('specialist evidence requires regular files');
      bytes += info.size;
      if (files.length >= 256 || info.size > 1024 * 1024 || bytes > 2 * 1024 * 1024)
        throw new Error('specialist evidence exceeds bounded input; narrow approved paths');
      const data = await readFile(path);
      if (data.includes(0)) throw new Error('specialist evidence contains binary input');
      const content = new TextDecoder('utf-8', { fatal: true }).decode(data);
      files.push({
        path: prefix + name,
        sha256: createHash('sha256').update(data).digest('hex'),
        content,
      });
    }
  };
  await visit(root, '');
  return files;
}

export async function specialistSourceEvidence(profile: SpecialistRoleProfile, root: string) {
  return profile.test ? undefined : collectSpecialistEvidence(root);
}
