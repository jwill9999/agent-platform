/**
 * Bash command validation — allowlist-based guard for the sys_bash tool.
 *
 * Commands are split on shell separators (|, &&, ||, ;) and each segment's
 * leading command is checked against the allowlist. Blocked patterns (rm -rf /,
 * sudo, curl|sh, etc.) are rejected before the allowlist check.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BashValidationResult {
  allowed: boolean;
  /** Human-readable reason when blocked. */
  reason?: string;
  /** The specific blocked pattern or command that triggered rejection. */
  matched?: string;
}

// ---------------------------------------------------------------------------
// Default allowlist — commands considered safe in an agent context
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
  // Navigation / inspection
  'ls',
  'cat',
  'echo',
  'pwd',
  'which',
  'env',
  'printenv',
  'whoami',
  'uname',
  'date',
  'wc',
  'head',
  'tail',
  'sort',
  'uniq',
  'cut',
  'tr',
  'tee',
  'diff',
  'tree',
  'file',
  'less',
  'more',
  'basename',
  'dirname',
  'realpath',
  'readlink',
  'stat',
  'du',
  'df',
  'true',
  'false',
  'test',
  '[',

  // Search
  'grep',
  'egrep',
  'fgrep',
  'find',
  'xargs',

  // Text processing
  'sed',
  'awk',
  'jq',
  'yq',
  'column',
  'fmt',
  'fold',
  'nl',
  'paste',
  'expand',
  'unexpand',

  // File operations (PathJail handles path validation)
  'touch',
  'mkdir',
  'cp',
  'mv',
  'ln',

  // Dev tools
  'git',
  'npm',
  'npx',
  'pnpm',
  'node',
  'tsc',
  'tsx',
  'python',
  'python3',
  'pip',
  'pip3',
  'make',
  'cmake',

  // Network (limited)
  'curl',
  'wget',
  'ping',
  'host',
  'dig',
  'nslookup',

  // Compression
  'tar',
  'gzip',
  'gunzip',
  'zip',
  'unzip',
  'bzip2',
  'xz',

  // Misc safe utilities
  'sha256sum',
  'sha512sum',
  'md5sum',
  'base64',
  'xxd',
  'printf',
  'sleep',
  'seq',
  'yes',
  'timeout',
  'time',
]);

// ---------------------------------------------------------------------------
// Blocked patterns — always rejected regardless of allowlist
// ---------------------------------------------------------------------------

interface BlockedPattern {
  /** RegExp to test against the full command string. */
  pattern: RegExp;
  /** Reason to report when matched. */
  reason: string;
}

const BLOCKED_PATTERNS: readonly BlockedPattern[] = [
  // Destructive force-recursive delete at root or system dirs
  { pattern: /\brm\s+.*-[^\s]*r[^\s]*f.*\s+\/(?:\s|$)/, reason: 'Blocked: rm -rf /' },
  { pattern: /\brm\s+.*-[^\s]*f[^\s]*r.*\s+\/(?:\s|$)/, reason: 'Blocked: rm -rf /' },

  // Privilege escalation
  { pattern: /\bsudo\b/, reason: 'Blocked: sudo is not allowed' },
  { pattern: /\bsu\s/, reason: 'Blocked: su is not allowed' },
  { pattern: /\bdoas\b/, reason: 'Blocked: doas is not allowed' },

  // Remote code execution via pipe to interpreter
  {
    pattern: /\|\s*(?:bash|sh|zsh|dash|ksh|csh|tcsh|fish)\b/,
    reason: 'Blocked: piping to a shell interpreter',
  },
  {
    pattern: /\|\s*(?:python|python3|node|ruby|perl|php)\b/,
    reason: 'Blocked: piping to an interpreter',
  },

  // Download + execute patterns
  { pattern: /\bcurl\b.*\|\s*(?:bash|sh)/, reason: 'Blocked: curl | sh pattern' },
  { pattern: /\bwget\b.*\|\s*(?:bash|sh)/, reason: 'Blocked: wget | sh pattern' },

  // eval / source with untrusted input
  { pattern: /\beval\s/, reason: 'Blocked: eval is not allowed' },

  // Dangerous redirects to system files
  { pattern: />\s*\/etc\//, reason: 'Blocked: writing to /etc/' },
  { pattern: />\s*\/root\//, reason: 'Blocked: writing to /root/' },
  { pattern: />\s*\/proc\//, reason: 'Blocked: writing to /proc/' },
  { pattern: />\s*\/sys\//, reason: 'Blocked: writing to /sys/' },

  // Accessing secrets/passwords
  { pattern: /\/etc\/shadow/, reason: 'Blocked: access to /etc/shadow' },
  { pattern: /\/etc\/passwd/, reason: 'Blocked: access to /etc/passwd' },

  // chmod world-writable / setuid
  { pattern: /\bchmod\s+[0-7]*7[0-7]{2}\b/, reason: 'Blocked: chmod world-writable' },
  { pattern: /\bchmod\s+[ug]\+s\b/, reason: 'Blocked: chmod setuid/setgid' },

  // Network tools that could exfiltrate data
  { pattern: /\bnc\b/, reason: 'Blocked: netcat (nc) is not allowed' },
  { pattern: /\bncat\b/, reason: 'Blocked: ncat is not allowed' },
  { pattern: /\bsocat\b/, reason: 'Blocked: socat is not allowed' },
  { pattern: /\btcpdump\b/, reason: 'Blocked: tcpdump is not allowed' },

  // Process manipulation
  { pattern: /\bkill\s+-9\s/, reason: 'Blocked: kill -9 is not allowed' },
  { pattern: /\bkillall\b/, reason: 'Blocked: killall is not allowed' },
  { pattern: /\bpkill\b/, reason: 'Blocked: pkill is not allowed' },

  // Disk operations
  { pattern: /\bdd\b/, reason: 'Blocked: dd is not allowed' },
  { pattern: /\bmkfs\b/, reason: 'Blocked: mkfs is not allowed' },
  { pattern: /\bfdisk\b/, reason: 'Blocked: fdisk is not allowed' },
  { pattern: /\bmount\b/, reason: 'Blocked: mount is not allowed' },
  { pattern: /\bumount\b/, reason: 'Blocked: umount is not allowed' },

  // Service/daemon control
  { pattern: /\bsystemctl\b/, reason: 'Blocked: systemctl is not allowed' },
  { pattern: /\bservice\b/, reason: 'Blocked: service is not allowed' },

  // Cron manipulation
  { pattern: /\bcrontab\b/, reason: 'Blocked: crontab is not allowed' },

  // Package manager installs (could install malicious packages)
  { pattern: /\bapt-get\s+install\b/, reason: 'Blocked: apt-get install is not allowed' },
  { pattern: /\bapt\s+install\b/, reason: 'Blocked: apt install is not allowed' },
  { pattern: /\byum\s+install\b/, reason: 'Blocked: yum install is not allowed' },
  { pattern: /\bdnf\s+install\b/, reason: 'Blocked: dnf install is not allowed' },
  { pattern: /\bapk\s+add\b/, reason: 'Blocked: apk add is not allowed' },
  { pattern: /\bbrew\s+install\b/, reason: 'Blocked: brew install is not allowed' },
];

// ---------------------------------------------------------------------------
// Shell splitting — tokenise command on shell separators
// ---------------------------------------------------------------------------

const SHELL_SEPARATORS = /\s*(?:\|\||\|&|\||&&|;)\s*/;

/**
 * Split a command string on shell separators (|, &&, ||, ;, |&) and return
 * the leading command word for each segment.
 *
 * Handles common prefixes like `env`, `nohup`, and variable assignments
 * (e.g. `FOO=bar cmd`).
 */
function extractLeadingCommands(command: string): string[] {
  const segments = command.split(SHELL_SEPARATORS).filter(Boolean);
  return segments.map((seg) => {
    const tokens = seg.trim().split(/\s+/);
    let idx = 0;

    // Skip env-like prefixes and variable assignments
    while (idx < tokens.length) {
      const tok = tokens[idx]!;
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) {
        idx++;
        continue;
      }
      if (['env', 'nohup', 'nice', 'ionice', 'command'].includes(tok)) {
        idx++;
        continue;
      }
      break;
    }

    if (idx >= tokens.length) return '';
    // Strip path prefix: /usr/bin/git → git
    const raw = tokens[idx] ?? '';
    const lastSlash = raw.lastIndexOf('/');
    return lastSlash >= 0 ? raw.slice(lastSlash + 1) : raw;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build an allowlist from the default set + optional env var additions.
 * `BASH_ALLOWLIST` is a comma-separated list of additional commands.
 */
export function buildAllowlist(envOverride?: string): ReadonlySet<string> {
  const extra = envOverride ?? process.env.BASH_ALLOWLIST ?? '';
  if (!extra.trim()) return DEFAULT_ALLOWED_COMMANDS;

  const combined = new Set(DEFAULT_ALLOWED_COMMANDS);
  for (const cmd of extra.split(',')) {
    const trimmed = cmd.trim();
    if (trimmed) combined.add(trimmed);
  }
  return combined;
}

/**
 * Validate a bash command string.
 *
 * 1. Check for blocked patterns (always rejected).
 * 2. Split on shell separators and check each segment's leading command
 *    against the allowlist.
 */
export function validateBashCommand(
  command: string,
  allowlist?: ReadonlySet<string>,
): BashValidationResult {
  const trimmed = command.trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Empty command' };
  }

  // Phase 1: blocked pattern scan (runs against full command string)
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason, matched: pattern.source };
    }
  }

  // Phase 2: allowlist check per shell segment
  const effectiveAllowlist = allowlist ?? buildAllowlist();
  const leadingCommands = extractLeadingCommands(trimmed);

  for (const cmd of leadingCommands) {
    if (!cmd) continue; // empty segment (trailing separator)
    if (!effectiveAllowlist.has(cmd)) {
      return {
        allowed: false,
        reason: `Command "${cmd}" is not in the allowed command list`,
        matched: cmd,
      };
    }
  }

  return { allowed: true };
}
