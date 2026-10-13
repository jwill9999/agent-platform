/** Move the private capability out of the general environment before any user child starts. */
export function takeDiagnosticCapability(env: NodeJS.ProcessEnv): string | undefined {
  const capability = env.DIAGNOSTICS_LOCAL_CAPABILITY;
  delete env.DIAGNOSTICS_LOCAL_CAPABILITY;
  return capability && /^[a-f0-9]{64}$/.test(capability) ? capability : undefined;
}

/** Only the managed API and local renderer server receive this explicit override. */
export function diagnosticChildEnvironment(
  env: NodeJS.ProcessEnv,
  capability?: string,
): NodeJS.ProcessEnv {
  const copy = { ...env };
  delete copy.DIAGNOSTICS_LOCAL_CAPABILITY;
  if (capability) copy.DIAGNOSTICS_LOCAL_CAPABILITY = capability;
  return copy;
}
