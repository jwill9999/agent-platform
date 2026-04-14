import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TARGET = process.env.API_PROXY_URL ?? 'http://127.0.0.1:3000';

async function forward(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const tail = path.join('/');
  const search = req.nextUrl.search;
  const dest = `${TARGET}/v1/${tail}${search}`;

  const headers = new Headers(req.headers);
  for (const name of ['host', 'connection', 'content-length']) {
    headers.delete(name);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const buf = await req.arrayBuffer();
    init.body = buf.byteLength ? buf : undefined;
  }

  const res = await fetch(dest, init);
  const outHeaders = new Headers(res.headers);
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
