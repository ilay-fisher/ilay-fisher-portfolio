/**
 * Scoped console logger. The only module in the codebase allowed to touch `console`
 * (enforced by ESLint `no-console`), so log output stays filterable in one place.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

const isLevel = (v: string | null): v is LogLevel => v !== null && v in RANK;

/**
 * Picks the starting level: `?log=<level>` wins, otherwise `debug` in dev and `warn` in prod.
 * Exported so the rule can be tested without touching module state.
 */
export function resolveInitialLevel(isDev: boolean, search: string): LogLevel {
  const fromUrl = new URLSearchParams(search).get('log');
  if (isLevel(fromUrl)) return fromUrl;
  return isDev ? 'debug' : 'warn';
}

let current: LogLevel = resolveInitialLevel(
  import.meta.env.DEV,
  typeof location === 'undefined' ? '' : location.search,
);

/** Sets the minimum level that is printed. Applies to every logger, including existing ones. */
export function setLogLevel(level: LogLevel): void {
  current = level;
}

/** Creates a logger whose output is prefixed `[portfolio:<scope>]`. */
export function createLogger(scope: string): Logger {
  const prefix = `[portfolio:${scope}]`;
  const make =
    (level: Exclude<LogLevel, 'silent'>) =>
    (msg: string, data?: unknown): void => {
      if (RANK[level] < RANK[current]) return;
      if (data === undefined) console[level](prefix, msg);
      else console[level](prefix, msg, data);
    };
  return { debug: make('debug'), info: make('info'), warn: make('warn'), error: make('error') };
}
