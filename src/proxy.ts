import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Route protection at the edge.
 *
 * Without this, /app is a statically prerendered shell that boots for anyone,
 * discovers a 401 from the API, and bounces back to /login — which reads as a
 * signup page that will not stay closed. Guarding here means an unauthenticated
 * visitor never loads the app shell at all.
 */

const SESSION_COOKIE = 'dealflow_session';
const PROTECTED = ['/app'];
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function sessionSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ??
    'dealflow-development-secret-do-not-use-in-production-0000000000';
  return new TextEncoder().encode(secret.padEnd(32, '0'));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF defence. The sandbox preview needs a SameSite=None cookie, which
  // browsers then attach to cross-site requests too — so any mutating call
  // carrying a session cookie must come from the same origin. Server-to-server
  // callers (webhooks, cron) send no Origin header and no cookie, so they are
  // untouched.
  if (MUTATING.has(request.method) && request.cookies.get(SESSION_COOKIE)) {
    const origin = request.headers.get('origin') ?? request.headers.get('referer');
    if (origin) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (originHost && originHost !== request.headers.get('host')) {
        return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
      }
    }
  }

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = token ? await isValid(token) : false;

  if (!authed) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    url.searchParams.set('reason', 'signin');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Middleware cannot read the database, so this only checks that the token is
 * well-formed and unexpired. Route handlers re-verify against the users table,
 * which is what actually authorises a request.
 */
async function isValid(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, sessionSecret());
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*'],
};
