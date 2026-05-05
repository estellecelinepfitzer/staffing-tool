import { NextRequest, NextResponse } from 'next/server';

// Cookie name must match lib/auth.ts — hardcoded here to avoid importing Node.js modules
// into the Edge runtime.
const COOKIE_NAME = 'checkin_session';

const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth',
  '/_next',
  '/favicon',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.includes('.')) {
    return NextResponse.next();
  }

  // Require session cookie
  const session = request.cookies.get(COOKIE_NAME);
  if (!session?.value) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?from=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
