import type { IpcMainInvokeEvent, WebContents } from 'electron';

export interface IpcValidationResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: string;
}

export type IpcPayloadValidator<T> = (payload: unknown) => IpcValidationResult<T>;

export function ok<T>(value: T): IpcValidationResult<T> {
  return { ok: true, value };
}

export function fail(error: string): IpcValidationResult<never> {
  return { ok: false, error };
}

export function validateNoPayload(payload: unknown): IpcValidationResult<void> {
  if (payload === undefined) {
    return ok(undefined);
  }

  return fail('Unexpected IPC payload.');
}

export function assertTrustedIpcSender(
  event: Pick<IpcMainInvokeEvent, 'sender'>,
  trustedWebContents: WebContents,
): void {
  if (event.sender !== trustedWebContents) {
    throw new Error('Rejected IPC call from untrusted sender.');
  }
}

export function validateIpcPayload<T>(payload: unknown, validator: IpcPayloadValidator<T>): T {
  const result = validator(payload);

  if (!result.ok) {
    throw new Error(result.error ?? 'Invalid IPC payload.');
  }

  return result.value as T;
}
