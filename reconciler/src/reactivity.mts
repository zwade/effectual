import { EffectualSlotElement } from "./elements.mjs";
import { GenerationalMap } from "./generational-map.mjs";
import { MemoEntry, memoItemsAreEqual, memoizeItem } from "./memo.mjs";

declare global {
    interface EffectualState {
        currentContext: SelfIdentity | null;
        currentStateContext: CurrentState | null;
        stateMap: WeakMap<SelfIdentity, Map<StoreIdentity, _StateContainer<any>>>;
        dependencyMap: WeakMap<SelfIdentity, Set<StateIdentity>>;
        effectCache: WeakMap<SelfIdentity, ElementCache<BaseEffectContainer>>;
        currentEffect: LifecycleEffectContainer | null;
        effectCount: number;
        dirtySet: Set<StateIdentity>;
        isDirty: boolean;
        _devIdCounter: number;
    }
}

const e = (globalThis.__effectual__ ??= {} as EffectualState);
e.currentContext = null;
e.currentStateContext = null;
e.stateMap = new WeakMap();
e.dependencyMap = new WeakMap();
e.effectCache = new WeakMap();
e.currentEffect = null;
e.effectCount = 0;
e.dirtySet = new Set();
e.isDirty = false;
e._devIdCounter = 0;

export { e };

export type CurrentState = GenerationalMap<StoreIdentity, _StateContainer<any>>;

// We have to do this because symbols aren't allowed as weak map keys
export type SelfIdentity = { __brand: "Self identity" };
export type StateIdentity = { __brand: "State identity" };
export type StoreIdentity = { __brand: "Store identity" };
export type EffectIdentity = { __brand: "Effect identity" };

export type Identity = SelfIdentity | StateIdentity | StoreIdentity | EffectIdentity;

const generateDevId = <T extends Identity>() => {
    e._devIdCounter += 1;
    return { id: e._devIdCounter } as unknown as T;
};

export const getNewIdentity = <T extends Identity>() => {
    if (__DEV__) {
        return generateDevId<T>();
    }

    return Object.create(null) as T;
};

export const resetCurrentContext = (id: SelfIdentity | null) => {
    e.currentContext = id;

    if (id) {
        e.effectCount = 0;
    }
};

export const needsRerender = () => {
    return e.isDirty;
};

export const pushCurrentStateContext = (id: SelfIdentity) => {
    if (!e.currentStateContext) {
        return;
    }

    e.currentStateContext.pushGeneration();
    const stateElements = e.stateMap.get(id);

    if (stateElements) {
        for (const [stateId, state] of stateElements) {
            state.tick();
            e.currentStateContext.set(stateId, state);
        }
    }
};

export const popCurrentStateContext = () => {
    if (!e.currentStateContext) {
        return;
    }

    e.currentStateContext.popGeneration();
};

export const resetDependencyState = () => {
    e.currentStateContext = new GenerationalMap();
};

export const resetDirtyState = () => {
    e.dirtySet = new Set();
    e.isDirty = false;
};

export const requestOrderBasedId = () => {
    const id = `$effect:${e.effectCount}`;
    e.effectCount += 1;

    return id;
};

export const cleanupEffects = () => {
    if (e.effectCache.has(e.currentContext!)) {
        const cache = e.effectCache.get(e.currentContext!)!;

        for (const [key, effect] of cache) {
            if (!effect.executed) {
                effect.cleanup();
                cache.remove(key);
            } else {
                effect.executed = false;
            }
        }
    }
};

export const finalCleanup = (identity: SelfIdentity) => {
    const cache = e.effectCache.get(identity);
    if (cache) {
        for (const [, effect] of cache) {
            effect.cleanup();
        }
    }

    e.effectCache.delete(identity);
};

export const reconcileEmits = (id: SelfIdentity, emits: Record<string, Function> | undefined) => {
    if (!emits) {
        return;
    }

    if (!e.effectCache.has(id)) {
        e.effectCache.set(id, new ElementCache());
    }

    const cache = e.effectCache.get(id)!;
    const result: Record<string, unknown> = Object.create(null);

    for (const key in emits) {
        if (!cache.has(key)) {
            cache.add(key, new EmitEffectContainer());
        }

        const container = cache.getLatest(key)! as EmitEffectContainer;
        result[key] = container.cachedFn;

        container.lastResult = emits[key];
        container.executed = true;
    }

    return result;
};

export const isElementDirty = (id: SelfIdentity) => {
    const personalStores = e.stateMap.get(id);
    if (personalStores) {
        for (const [_storeId, state] of personalStores) {
            if (e.dirtySet.has(state.id)) {
                return true;
            }
        }
    }

    const dependencies = e.dependencyMap.get(id);
    if (dependencies) {
        for (const dependency of dependencies) {
            if (e.dirtySet.has(dependency)) {
                return true;
            }
        }
    }

    return false;
};

export abstract class BaseStore<Data> {
    protected id;
    protected default;

    constructor(default_: Data) {
        this.id = getNewIdentity<StoreIdentity>();
        this.default = default_;
    }

    public $provide(): StateContainer<Data> {
        const element = e.currentContext!;
        if (!e.stateMap.has(element)) {
            e.stateMap.set(element, new Map());
        }

        if (e.stateMap.get(element)?.has(this.id)) {
            return new StateContainer(e.stateMap.get(element)?.get(this.id)!);
        }

        const container = new _StateContainer(this.default);
        e.stateMap.get(element)?.set(this.id, container);
        e.currentStateContext?.set(this.id, container);

        return new StateContainer(container);
    }

    protected useContainer() {
        const container = e.currentStateContext?.get(this.id) as _StateContainer<Data> | undefined;
        const currentRenderer = e.currentContext;

        if (!currentRenderer) {
            __LOG__("warn", "Can't invoke `use` outside of a render function.");
            return undefined;
        }

        if (!container) {
            __LOG__("warn", "Trying to use container that hasn't been provided");
            return undefined;
        }

        if (!e.dependencyMap.has(currentRenderer)) {
            e.dependencyMap.set(currentRenderer, new Set());
        }

        e.dependencyMap.get(currentRenderer)?.add(container.id);
        return container;
    }
}

class _StateContainer<T> {
    #currentValue: T;
    #nextValue: T;
    #dirty = false;
    #stateId;

    constructor(default_: T) {
        this.#currentValue = default_;
        this.#nextValue = default_;
        this.#stateId = getNewIdentity<StateIdentity>();
    }

    public setValue(value: T) {
        this.#nextValue = value;
        if (!this.#dirty) {
            e.dirtySet.add(this.#stateId);

            this.#dirty = true;
            e.isDirty = true;
        }
    }

    public getValue() {
        if (e.currentEffect) {
            e.currentEffect.addDependency(this.#stateId);
        }

        return this.#currentValue;
    }

    public getNextValue() {
        return this.#nextValue;
    }

    public tick() {
        if (this.#dirty) {
            this.#dirty = false;
            this.#currentValue = this.#nextValue;
        }
    }

    public get id() {
        return this.#stateId;
    }

    public toString() {
        return `StateContainer(dirty=${this.#dirty}, current=${this.#currentValue}, next=${this.#nextValue})`;
    }
}

export class StateContainer<T> {
    #base;

    constructor(container: _StateContainer<T>) {
        this.#base = container;
    }

    public get value() {
        return this.getValue();
    }

    public getValue() {
        return this.#base.getValue();
    }

    public set(cb: (next: T) => T) {
        this.#base.setValue(cb(this.#base.getNextValue()));
    }

    public setValue(value: T) {
        return this.#base.setValue(value);
    }
}

export class ElementCache<Data = unknown> {
    #current: Record<string, Data>;

    constructor() {
        this.#current = {};
    }

    public has(key: string) {
        // eslint-disable-next-line no-prototype-builtins
        return this.#current.hasOwnProperty(key);
    }

    public getLatest(key: string) {
        return this.#current[key];
    }

    public merge(values: Record<string, Data>) {
        for (const [key, value] of Object.entries(values)) {
            this.#current[key] = value;
        }
    }

    public add(key: string, value: Data) {
        this.#current[key] = value;
    }

    public remove(key: string) {
        delete this.#current[key];
    }

    public [Symbol.iterator]() {
        return Object.entries(this.#current)[Symbol.iterator]();
    }
}

export function effectWatch<Data, Args extends any[]>(
    key: string,
    fn: (...args: Args) => Generator<Data, void> | Data,
    args: Args,
    options: RunEffectOptions,
) {
    if (!e.effectCache.has(e.currentContext!)) {
        e.effectCache.set(e.currentContext!, new ElementCache());
    }

    const cache = e.effectCache.get(e.currentContext!)!;

    let effect: LifecycleEffectContainer;
    if (!cache.has(key)) {
        effect = new LifecycleEffectContainer(fn);
        cache.add(key, effect);
        effect.run(args, options);
    } else {
        effect = cache.getLatest(key)! as LifecycleEffectContainer;

        if (effect.isDirty(args)) {
            effect.run(args, options);
        }
    }

    effect.executed = true;

    return effect.lastResult as Data;
}

export interface RunEffectOptions {
    dontWatch?: boolean;
}

export abstract class BaseEffectContainer {
    public lastResult: unknown;
    public executed = false;

    public abstract cleanup(): void;
}

export class EmitEffectContainer extends BaseEffectContainer {
    public cachedFn;

    constructor() {
        super();

        this.cachedFn = (...args: unknown[]) => {
            const fn = this.lastResult as Function;
            if (__DEV__) {
                if (args.length > fn.length) {
                    __LOG__("warn", `Received ${args.length} arguments but expected ${fn.length}`);
                }
            }

            return fn?.(...args);
        };
    }

    public cleanup() {
        // Nothing to do
    }
}

export class LifecycleEffectContainer extends BaseEffectContainer {
    #dependencies = new Set<StateIdentity>();
    #cleanup: (() => void) | undefined;
    #fn;
    #previousArgs: MemoEntry | undefined;

    constructor(fn: (...args: any[]) => Generator<unknown, void> | unknown) {
        super();

        this.#fn = fn;
        this.lastResult = undefined;
        this.#previousArgs = undefined;
    }

    public isDirty(args: any[]) {
        const newArgs = memoizeItem(args);
        const argsChanged = !this.#previousArgs || !memoItemsAreEqual(this.#previousArgs, newArgs);
        const dependencyChanged = [...this.#dependencies].some((dep) => e.dirtySet.has(dep));

        return argsChanged || dependencyChanged;
    }

    public addDependency(state: StateIdentity) {
        this.#dependencies.add(state);
    }

    public run(args: any[], options: RunEffectOptions) {
        this.#dependencies = new Set();
        this.#previousArgs = memoizeItem(args);

        try {
            if (this.#cleanup) {
                this.#cleanup();
                this.#cleanup = undefined;
            }

            if (!options.dontWatch) {
                e.currentEffect = this;
            }

            const result = this.#fn(...args) as Generator<number, void> | number; // We use `number` kind of arbitrarily here so the types are reasonable-ish
            if (result && typeof result === "object" && typeof result["next"] === "function") {
                const generatorResult = result.next();
                this.lastResult = generatorResult.value;

                if (!generatorResult.done) {
                    this.#cleanup = () => {
                        try {
                            result.next();
                        } catch (e) {
                            __LOG__("warn", "Cleanup failed", e);
                        }
                    };
                }
            } else {
                this.lastResult = result;
            }
        } catch (e) {
            __LOG__("warn", "Effect failed", e);
        } finally {
            e.currentEffect = null;
        }
    }

    public cleanup() {
        if (this.#cleanup) {
            this.#cleanup();
        }
    }
}

export const SlotGenerator = new Proxy({} as Record<string, EffectualSlotElement>, {
    get(target, p: string): EffectualSlotElement {
        return { kind: "slot", name: p };
    },
});

Object.freeze(SlotGenerator);
