import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendOrigin(): string | null {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.API_BACKEND_URL?.trim() ||
    "";
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function forwardRequestHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  const origin = backendOrigin();
  if (!origin) {
    return NextResponse.json(
      {
        detail:
          "Server misconfiguration: set BACKEND_URL (or API_BACKEND_URL) to your FastAPI origin, e.g. https://your-api.example.com",
      },
      { status: 503 },
    );
  }

  if (pathSegments.length === 0) {
    return NextResponse.json(
      { detail: "Missing path after /api/backend/" },
      { status: 404 },
    );
  }

  const targetPath = `/${pathSegments.join("/")}`;
  const targetUrl = `${origin}${targetPath}${req.nextUrl.search}`;

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  let body: ArrayBuffer | undefined;
  if (hasBody) {
    body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: forwardRequestHeaders(req.headers),
      body: hasBody ? body : undefined,
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { detail: `Upstream fetch failed: ${msg}` },
      { status: 502 },
    );
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      resHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return proxy(req, path);
}
