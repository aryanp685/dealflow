import { Redis } from '@upstash/redis';


export type LimitSpec = { limit: number; windowMs: number };

export const LIMITS = {
  login: { limit: 8, windowMs: 10 * 60_000 },
  loginIp: { limit: 30, windowMs: 10 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  forgotPassword: { limit: 3, windowMs: 60 * 60_000 },
  resetPassword: { limit: 5, windowMs: 60 * 60_000 },
  licenseRedeem: { limit: 10, windowMs: 60 * 60_000 },
} satisfies Record<string, LimitSpec>;

let _redis: Redis | null | undefined;

function redis(): Redis | null {
  if (_redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    _redis = url && token ? new Redis({ url, token }) : null;
  }
  return _redis;
}

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export async function rateLimit(key: string, spec: LimitSpec): Promise<RateLimitResult> {
  const r = redis();
  return r ? redisWindow(r, key, spec) : memoryWindow(key, spec);
}

async function redisWindow(r: Redis, key: string, spec: LimitSpec): Promise<RateLimitResult> {
  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2)}`;
  const pipeline = r.pipeline();
  pipeline.zremrangebyscore(key, 0, now - spec.windowMs);
  pipeline.zadd(key, { score: now, member });
  pipeline.zcard(key);
  pipeline.zrange(key, 0, 0, { withScores: true });
  pipeline.pexpire(key, spec.windowMs);
  const [, , count, oldest] = (await pipeline.exec()) as [
    number,
    number,
    number,
    { member: string; score: number }[],
    boolean,
  ];

  if (count <= spec.limit) {
    return { ok: true, remaining: spec.limit - count, retryAfterSeconds: 0 };
  }
  const firstHit = oldest[0]?.score ?? now;
  const retryAfterSeconds = Math.max(1, Math.ceil((firstHit + spec.windowMs - now) / 1000));
  return { ok: false, remaining: 0, retryAfterSeconds };
}


const hits = new Map<string, number[]>();
let sweeper: ReturnType<typeof setInterval> | null = null;

function startSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < 3_600_000);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }, 10 * 60_000);
  sweeper.unref?.();
}

function memoryWindow(key: string, spec: LimitSpec): RateLimitResult {
  startSweeper();
  const now = Date.now();
  const times = (hits.get(key) ?? []).filter((t) => now - t < spec.windowMs);

  if (times.length >= spec.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((times[0] + spec.windowMs - now) / 1000));
    hits.set(key, times);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  times.push(now);
  hits.set(key, times);
  return { ok: true, remaining: spec.limit - times.length, retryAfterSeconds: 0 };
}

export function resetRateLimits() {
  hits.clear();
}


export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function tooManyRequests(retryAfterSeconds: number, scope: string) {
  const minutes = Math.round(retryAfterSeconds / 60);
  const wait = retryAfterSeconds >= 60 ? `${minutes} minute(s)` : `${retryAfterSeconds} second(s)`;
  return Response.json(
    { error: `Too many attempts. Try again in ${wait}.`, code: 'rate_limited', scope, retry_after: retryAfterSeconds },
    { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } }
  );
}
