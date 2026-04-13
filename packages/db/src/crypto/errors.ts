/** Thrown when the master key env value is missing or invalid. */
export class SecretKeyError extends Error {
  readonly name = 'SecretKeyError';
}

/** Thrown when decryption or authentication fails (wrong key, tampered blob). */
export class SecretDecryptionError extends Error {
  readonly name = 'SecretDecryptionError';
}
