type Primitive = string | boolean | number | bigint | symbol | undefined | null; // symbols are a questionable choice here
export type MemoEntry = [Key: string, Value: Primitive | WeakRef<object>][];

const memoizeSingleObject = (value: unknown) => {
    if ((typeof value === "object" || typeof value === "function") && value !== null) {
        return new WeakRef(value);
    }

    return value as Primitive;
};

export const memoizeItem = (props?: Record<string, unknown>) => {
    const cacheObject: MemoEntry = [];
    if (props === undefined) {
        return cacheObject;
    }

    const keys = Object.keys(props).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
        const value = props[key];
        cacheObject.push([key, memoizeSingleObject(value)]);
    }

    return cacheObject;
};

export const memoItemsAreEqual = (a: MemoEntry, b: MemoEntry) => {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i][0] !== b[i][0]) {
            return false;
        }

        const aValue = a[i][1];
        const bValue = b[i][1];

        if (aValue !== bValue) {
            return false;
        }

        if (aValue instanceof WeakRef && bValue instanceof WeakRef) {
            if (aValue.deref() !== bValue.deref() || aValue.deref() === undefined) {
                return false;
            }
        }
    }

    return true;
};
