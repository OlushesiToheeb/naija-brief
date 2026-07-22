// Shared browser-origin policy, used both for CORS and for guarding
// state-changing endpoints against cross-site (CSRF) requests.

export function corsOrigins(): (string | RegExp)[] {
  const configured = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  // Default: any localhost port in dev.
  return configured.length ? configured : [/^http:\/\/localhost(:\d+)?$/];
}

/**
 * True if a request's Origin header is allowed. A missing Origin (curl, native
 * apps, server-to-server) is allowed — those carry no cross-site CSRF risk.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return corsOrigins().some((o) =>
    typeof o === "string" ? o === origin : o.test(origin),
  );
}
