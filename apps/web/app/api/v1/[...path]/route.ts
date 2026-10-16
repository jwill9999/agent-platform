import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TARGET = process.env.API_PROXY_URL ?? 'http://127.0.0.1:3000';

function admitBrowserStop(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return false;
  if (!origin) return !site; // Non-browser clients retain the shared headless interface.
  try {
    const expected = new URL(
      `${req.nextUrl.protocol}//${req.headers.get('host') ?? req.nextUrl.host}`,
    );
    const supplied = new URL(origin);
    const desktopHost = process.env.DIAGNOSTICS_WEB_HOST;
    return (
      ['127.0.0.1', 'localhost', '[::1]'].includes(expected.hostname) &&
      (!desktopHost || expected.host === desktopHost) &&
      supplied.origin === origin &&
      supplied.origin === expected.origin &&
      !supplied.username &&
      !supplied.password &&
      req.headers.get('content-type')?.split(';')[0]?.trim() === 'application/json'
    );
  } catch {
    return false;
  }
}

async function forward(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const isStop =
    req.method === 'POST' &&
    path.length === 5 &&
    path[0] === 'sessions' &&
    path[2] === 'runs' &&
    path[4] === 'stop';
  if (isStop && !admitBrowserStop(req))
    return NextResponse.json(
      {
        error: {
          code: 'STOP_ORIGIN_DENIED',
          message: 'Stop requires a trusted local request origin.',
        },
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  const tail = path.join('/');
  const search = req.nextUrl.search;
  const dest = `${TARGET}/v1/${tail}${search}`;

  const headers = new Headers(req.headers);
  for (const name of ['host', 'connection', 'content-length']) {
    headers.delete(name);
  }

  if (isStop) {
    // These belong to the admitted renderer request, not this new server request.
    // No caller-controlled privilege header is added or trusted by the API.
    for (const name of [
      'origin',
      'sec-fetch-site',
      'sec-fetch-mode',
      'sec-fetch-dest',
      'sec-fetch-user',
    ])
      headers.delete(name);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  // Cancellation is intentionally scoped to these read-only operations. In
  // particular, aborting a browser request must not imply a Git write rolled back.
  if (
    req.method === 'GET' &&
    path.length === 4 &&
    path[0] === 'projects' &&
    ((path[2] === 'git' && path[3] === 'checks') ||
      (path[2] === 'github' && path[3] === 'pull-requests'))
  ) {
    init.signal = req.signal;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const buf = await req.arrayBuffer();
    init.body = buf.byteLength ? buf : undefined;
  }

  const res = await fetch(dest, init);
  const outHeaders = new Headers(res.headers);
  outHeaders.delete('x-diagnostics-capability');
  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
