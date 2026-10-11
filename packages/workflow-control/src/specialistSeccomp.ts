/**
 * Docker/Moby default profile, Apache-2.0, copyright Moby contributors.
 * https://github.com/moby/profiles/blob/85e237f1fe229a0c61c9c7d8e743fa780d3b97ca/seccomp/default.json
 * Vendored rather than fetched at launch. Additions at the end permit bubblewrap to
 * create an unprivileged user namespace and mount inside it. Host namespace operations
 * still require capabilities the container does not have. No SYS_ADMIN or privileged mode.
 * Tested on Linux arm64; requalify pinned client/image/kernel changes.
 */
import dockerDefault from './dockerDefaultSeccomp.json' with { type: 'json' };

export const SPECIALIST_SECCOMP = {
  ...dockerDefault,
  syscalls: [
    ...dockerDefault.syscalls,
    {
      names: ['unshare', 'mount', 'umount2', 'pivot_root', 'setns'],
      action: 'SCMP_ACT_ALLOW',
      args: [],
    },
    // On the supported amd64/arm64 ABIs, clone flags are argument zero. Require CLONE_NEWUSER.
    {
      names: ['clone'],
      action: 'SCMP_ACT_ALLOW',
      args: [{ index: 0, value: 268435456, valueTwo: 268435456, op: 'SCMP_CMP_MASKED_EQ' }],
    },
  ],
};
