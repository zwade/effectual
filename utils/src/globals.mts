// Mimicing react's pattern here
// The general idea is that once we're ready to build an actual bundle
// We hardcode __DEV__ to true or false which lets deadcode elimination
// remove any unreachable code

declare global {
    /* eslint-disable no-var */
    type LogLevel = "debug" | "info" | "warn" | "error";

    /**
     * Hardcoded value indicating if we're in a development build
     */
    var __DEV__: boolean;
    var __LOG_LEVEL__: LogLevel;

    /**
     * Dev utility to assert that a condition is true
     * Please only use inside an `if (__DEV__)` block
     */
    var __ASSERT__: (condition: boolean, message: string) => void;

    var __effectual__: {
        hooks: Map<string, Set<(...args: any[]) => void>>;
    };

    var __TRIGGER__: (hook: string, ...args: any[]) => void;
    var __HOOK__: (hook: string, callback: (...args: any[]) => void) => void;
    var __UNHOOK__: (hook: string, callback: (...args: any[]) => void) => void;
    var __LOG__: (level: LogLevel, message: string, ...args: unknown[]) => void;
    /* eslint-enable no-var */
}

globalThis.__DEV__ = true;
globalThis.__LOG_LEVEL__ = "warn";
globalThis.__HOOK__ = () => {};
globalThis.__UNHOOK__ = () => {};

if (__DEV__) {
    globalThis.__ASSERT__ = (condition: boolean, message: string) => {
        if (!condition) {
            throw new Error(message);
        }
    };

    globalThis.__effectual__ = {
        hooks: new Map(),
    };

    globalThis.__TRIGGER__ = (hook: string, ...args) => {
        const callbacks = globalThis.__effectual__.hooks.get(hook);
        if (callbacks !== undefined) {
            for (const callback of callbacks) {
                callback(...args);
            }
        }
    };

    globalThis.__HOOK__ = (hook: string, callback: () => void) => {
        const callbacks = globalThis.__effectual__.hooks.get(hook);
        if (callbacks !== undefined) {
            callbacks.add(callback);
        } else {
            globalThis.__effectual__.hooks.set(hook, new Set([callback]));
        }
    };

    globalThis.__UNHOOK__ = (hook: string, callback: () => void) => {
        const callbacks = globalThis.__effectual__.hooks.get(hook);
        if (callbacks !== undefined) {
            callbacks.delete(callback);
        }
    };

    globalThis.__LOG__ = (level: LogLevel, message: string, ...args: unknown[]) => {
        const order = { debug: 0, info: 1, warn: 2, error: 3 };

        if (order[level] >= order[__LOG_LEVEL__]) {
            // console.warn(`${level}:`, message, ...args);
        }
    };
}
