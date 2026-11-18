import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger, resolveInitialLevel, setLogLevel } from './logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setLogLevel('debug');
  });

  it('prefixes messages with the scope', () => {
    setLogLevel('debug');
    createLogger('hero').info('ready');
    expect(console.info).toHaveBeenCalledWith('[portfolio:hero]', 'ready');
  });

  it('passes the data argument through', () => {
    setLogLevel('debug');
    const data = { a: 1 };
    createLogger('x').error('boom', data);
    expect(console.error).toHaveBeenCalledWith('[portfolio:x]', 'boom', data);
  });

  it('filters by level', () => {
    setLogLevel('warn');
    const log = createLogger('x');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('silent suppresses everything', () => {
    setLogLevel('silent');
    const log = createLogger('x');
    log.error('e');
    log.warn('w');
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('applies a level change to loggers created earlier', () => {
    const log = createLogger('x');
    setLogLevel('error');
    log.warn('w');
    expect(console.warn).not.toHaveBeenCalled();
    setLogLevel('debug');
    log.warn('w');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe('resolveInitialLevel', () => {
  it('defaults to debug in dev and warn in prod', () => {
    expect(resolveInitialLevel(true, '')).toBe('debug');
    expect(resolveInitialLevel(false, '')).toBe('warn');
  });
  it('lets ?log= override the default', () => {
    expect(resolveInitialLevel(false, '?log=debug')).toBe('debug');
    expect(resolveInitialLevel(true, '?x=1&log=error')).toBe('error');
  });
  it('ignores invalid ?log= values', () => {
    expect(resolveInitialLevel(false, '?log=loud')).toBe('warn');
  });
});
