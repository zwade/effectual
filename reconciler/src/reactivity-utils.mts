import { BaseStore, createSimpleState, effectWatch, requestOrderBasedId } from "./reactivity.mjs";

export class Store<Data> extends BaseStore<Data> {
    public $use(): Data {
        const container = this.useContainer();
        if (container) {
            return container.getValue();
        }

        return this.default;
    }

    public static create<T>(): Store<T | undefined>;
    public static create<T>(default_: T): Store<T>;
    public static create<T>(default_?: T): Store<T | undefined> {
        return new Store<T | undefined>(default_);
    }
}

export class AssignableStore<Data> extends BaseStore<Data> {
    public $use(): [Data, (value: Data) => void] {
        const container = this.useContainer();
        if (container) {
            return [container.getValue(), container.setValue.bind(container)];
        }

        return [
            this.default,
            () => {
                throw new Error("Cannot set value on unmounted store");
            },
        ];
    }

    public static create<T>(): AssignableStore<T | undefined>;
    public static create<T>(default_: T): AssignableStore<T>;
    public static create<T>(default_?: T): AssignableStore<T | undefined> {
        return new AssignableStore<T | undefined>(default_);
    }
}

/**
 * Invokes its function when the component mounts, and then
 * re-runs it if any of the arguments change.
 *
 * The return value of the function is returned and then
 * memoized.
 *
 * Additionally, if the function is a generator, data can
 * be returned via a `yield`, and any cleanup actions can
 * be performed after the yield. Any cleanup actions will
 * be run before this effect is re-ran, or before the component
 * unmounts
 *
 * Example:
 *
 * ```ts
 * interface Props {
 *   name: string;
 * }
 *
 * const MonitorSpaceKey = (props: Props) => {
 *   $effect(function*(name) {
 *     const cb = (e) => {
 *       if (e.code === "Space") {
 *         console.log(`${name} says hi`);
 *       }
 *     }
 *
 *     window.addEventListener("keydown", cb);
 *     yield;
 *
 *     window.removeEventListener("keydown", cb);
 *   }, [props.name]);
 *
 *   return (
 *     <div>
 *       Press Space!
 *     </div>
 *   );
 * }
 * ```
 */
export function $effect<Data>(fn: () => Generator<Data, void> | Data): Data;
export function $effect<Data, Args extends any[]>(
    fn: (...args: Args) => Generator<Data, void> | Data,
    args: Args,
): Data;
export function $effect<Data, Args extends any[]>(
    fn: (...args: Args) => Generator<Data, void> | Data,
    args: Args = [] as unknown as Args,
): Data {
    const id = requestOrderBasedId();

    return effectWatch(id, fn, args, { dontWatch: true });
}

/**
 * Named watch behaves the same as $watch, except it can be
 * used in a conditional (or out of order) context.
 */
export function $namedWatch<Data>(key: string, fn: () => Generator<Data, void> | Data): Data;
export function $namedWatch<Data, Args extends any[]>(
    key: string,
    fn: (...args: Args) => Generator<Data, void> | Data,
    args: Args,
): Data;
export function $namedWatch<Data, Args extends any[]>(
    key: string,
    fn: (...args: Args) => Generator<Data, void> | Data,
    args: Args = [] as unknown as Args,
) {
    return effectWatch(key, fn, args, {});
}

/**
 * A variant of $effect that also watches for changes in stores
 * used by the callback (e.g. with a `store.getValue()` or
 * `store.value` call).
 *
 * Example:
 *
 * ```ts
 * const Flipped = Store.create(false);
 *
 * const LogFlip = () => {
 *   const flipped = Flipped.$use();
 *
 *   $watch(() => {
 *    console.log("Flip:", flipped.value);
 *   });
 *
 *   return (
 *     <button
 *       $on:click={() => flipped.set((flip) => !flip)}
 *     >
 *       Flipped: { flipped.value }
 *     </button>
 *   );
 * }
 * ```
 */
export function $watch<Data>(fn: () => Generator<Data, void> | Data): Data;
export function $watch<Data, Args extends any[]>(fn: (...args: Args) => Generator<Data, void> | Data, args: Args): Data;
export function $watch<Data, Args extends any[]>(
    fn: (...args: Args) => Generator<Data, void> | Data,
    args: Args = [] as unknown as Args,
) {
    const id = requestOrderBasedId();

    return effectWatch(id, fn, args, {});
}

export const $state = <Data,>(default_: Data) => {
    const id = requestOrderBasedId();
    const state = createSimpleState<Data>(id, { default: default_ });

    return state;
};

export const $onMount = <Data,>(fn: () => Data) => {
    const id = requestOrderBasedId();
    return effectWatch(id, fn, [], {});
};

export const $onUnmount = (fn: () => void) => {
    const id = requestOrderBasedId();

    const effectFn = function* () {
        yield;
        fn();
    };

    return effectWatch(id, effectFn, [], {});
};
