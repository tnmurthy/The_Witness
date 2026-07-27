/**
 * Logging (Milestone 1).
 *
 * A small structured-logging wrapper rather than raw console.log calls
 * scattered through the codebase. Every log line is a single JSON object
 * with a level, message, timestamp, and optional context — which is what
 * lets a hosting platform's log drain (Vercel, or any log aggregator
 * behind it) filter and query logs instead of grepping text.
 *
 * This is intentionally NOT a third-party logging service integration
 * (Sentry, Axiom, Datadog, etc.) — wiring one of those up is an
 * infrastructure decision for Milestone 12 (Production Deployment) per
 * the Implementation Plan, once there's a real hosting environment to
 * point it at. This module is the stable call-site API
 * (`logger.info(...)`, `logger.error(...)`) that a later milestone can
 * repoint to a real sink without touching every call site.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      // eslint-disable-next-line no-console -- deliberate: this is the logger itself
      console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== "production") emit("debug", message, context);
  },
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => {
    // Normalize Error objects into serializable context so stack traces
    // survive JSON.stringify (a raw Error logs as `{}`).
    if (context?.error instanceof Error) {
      const { error, ...rest } = context;
      emit("error", message, {
        ...rest,
        error: { name: error.name, message: error.message, stack: error.stack },
      });
      return;
    }
    emit("error", message, context);
  },
};
