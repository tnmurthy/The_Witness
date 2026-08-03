/**
 * src/lib/rate-limit.ts
 *
 * Rate limiting for AI Workspace routes using Upstash Ratelimit.
 * Keyed by user id (authenticated) or IP (unauthenticated).
 *
 * Limits (conservative defaults — adjust based on real usage data):
 *   AI routes:     10 requests / minute per user
 *   Subscribe:     5 requests / 10 minutes per IP
 *
 * Falls back gracefully if UPSTASH_REDIS_REST_URL / TOKEN are not set —
 * rate limiting is skipped (app still works, just unprotected until keys
 * are added). This prevents a missing env var from breaking the app in
 * development.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
let _aiLimiter: Ratelimit | null = null;
let _subscribeLimiter: Ratelimit | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

export function getAIRateLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_aiLimiter) {
    _aiLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "witness:ai",
    });
  }
  return _aiLimiter;
}

export function getSubscribeRateLimiter(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  if (!_subscribeLimiter) {
    _subscribeLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      analytics: true,
      prefix: "witness:subscribe",
    });
  }
  return _subscribeLimiter;
}

export function isRateLimitConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
