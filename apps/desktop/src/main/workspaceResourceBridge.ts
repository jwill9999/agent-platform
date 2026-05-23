import type { DesktopWorkspaceOpenResult } from '@agent-platform/contracts';

import type { IpcValidationResult } from './ipcValidation.js';
import { fail, ok } from './ipcValidation.js';
import type { DesktopWebViewBoundsRequest, DesktopWebViewIdRequest } from './webviewService.js';

const WORKSPACE_RESOURCE_URI_PATTERN =
  /^workspace:\/\/project\/([^/\s]+)\/(file|diff|preview|terminal|webview)\/.+$/;

export interface DesktopWorkspaceOpenResourceRequest {
  readonly uri: string;
  readonly projectId?: string;
}

export interface DesktopWorkspaceOpenExternalFallbackRequest {
  readonly url: string;
}

export interface DesktopWorkspaceOpenWebViewRequest {
  readonly url: string;
  readonly projectId?: string;
}

export interface DesktopWorkspaceOpenExternalFallbackResult {
  readonly ok: true;
  readonly handled: true;
  readonly externalFallbackUrl: string;
}

export function workspaceOpenFallbackResult(reason: string): DesktopWorkspaceOpenResult {
  return {
    ok: true,
    handled: false,
    reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateDesktopWorkspaceOpenResourceRequest(
  payload: unknown,
): IpcValidationResult<DesktopWorkspaceOpenResourceRequest> {
  if (!isRecord(payload)) return fail('Workspace resource payload must be an object.');
  const uri = payload['uri'];
  if (typeof uri !== 'string') return fail('Workspace resource URI is invalid.');
  const match = WORKSPACE_RESOURCE_URI_PATTERN.exec(uri);
  if (!match) return fail('Workspace resource URI is invalid.');
  return ok({ uri, projectId: match[1] });
}

export function validateDesktopWorkspaceOpenExternalFallbackRequest(
  payload: unknown,
): IpcValidationResult<DesktopWorkspaceOpenExternalFallbackRequest> {
  if (!isRecord(payload)) return fail('Workspace external fallback payload must be an object.');
  const url = payload['url'];
  if (typeof url !== 'string' || !validHttpUrl(url)) {
    return fail('External fallback URL must be an http(s) URL.');
  }
  return ok({ url });
}

export function validateDesktopWorkspaceOpenWebViewRequest(
  payload: unknown,
): IpcValidationResult<DesktopWorkspaceOpenWebViewRequest> {
  if (!isRecord(payload)) return fail('Workspace webview payload must be an object.');
  const url = payload['url'];
  if (typeof url !== 'string' || !validHttpUrl(url)) {
    return fail('WebView URL must be an http(s) URL.');
  }
  const projectId = payload['projectId'];
  if (projectId !== undefined && (typeof projectId !== 'string' || !projectId.trim())) {
    return fail('Project id must be a non-empty string.');
  }
  return ok({
    url,
    ...(typeof projectId === 'string' ? { projectId } : {}),
  });
}

export function validateDesktopWorkspaceWebViewIdRequest(
  payload: unknown,
): IpcValidationResult<DesktopWebViewIdRequest> {
  if (!isRecord(payload)) return fail('Workspace WebView id payload must be an object.');
  const webviewId = payload['webviewId'];
  if (typeof webviewId !== 'string' || !webviewId.startsWith('webview-')) {
    return fail('WebView id is invalid.');
  }
  return ok({ webviewId });
}

export function validateDesktopWorkspaceWebViewBoundsRequest(
  payload: unknown,
): IpcValidationResult<DesktopWebViewBoundsRequest> {
  if (!isRecord(payload)) return fail('Workspace WebView bounds payload must be an object.');
  const id = validateDesktopWorkspaceWebViewIdRequest(payload);
  if (!id.ok || !id.value) return fail(id.error ?? 'WebView id is invalid.');
  const bounds = payload['bounds'];
  if (!isRecord(bounds)) return fail('WebView bounds must be an object.');
  const x = bounds['x'];
  const y = bounds['y'];
  const width = bounds['width'];
  const height = bounds['height'];
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 0 ||
    height < 0
  ) {
    return fail('WebView bounds must be finite non-negative dimensions.');
  }
  return ok({
    webviewId: id.value.webviewId,
    bounds: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    },
  });
}
