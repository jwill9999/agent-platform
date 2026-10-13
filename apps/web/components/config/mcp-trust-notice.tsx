export function McpTrustNotice() {
  return (
    <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 p-3">
      Connect only servers you trust. Testing and future chats can start a process or contact an
      endpoint. Local servers run with the API host’s access: on this machine in the desktop app, or
      inside the API container when using Docker. Install the executable there first; a Mac path is
      not a Docker path. Commands can themselves download or run code. Tool approval does not
      sandbox server startup. Saving a configuration does not connect it.
    </p>
  );
}
