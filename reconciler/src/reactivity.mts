import { EffectualSlotElement } from "./elements.mjs";
import { GenerationalMap } from "./generational-map.mjs";

declare global {
    interface EffectualState {
        currentContext: SelfIdentity | null;
        currentStateContext: CurrentState | null;
        stateMap: WeakMap<SelfIdentity, Map<StoreIdentity, _StateContainer<any>>>;
        dependencyMap: WeakMap<SelfIdentity, Set<StateIdentity>>;
        elementCache: WeakMap<SelfIdentity, ElementCache>;
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
e.elementCache = new WeakMap();
e.dirtySet = new Set();
e.isDirty = false;
e._devIdCounter = 0;

export type CurrentState = GenerationalMap<StoreIdentity, _StateContainer<any>>;

// We have to do this because symbols aren't allowed as weak map keys
export type SelfIdentity = { __brand: "Self identity" };
export type StateIdentity = { __brand: "State identity" };
export type StoreIdentity = { __brand: "Store identity" };

const generateDevId = <T extends SelfIdentity | StateIdentity | StoreIdentity>() => {
    e._devIdCounter += 1;
    return { id: e._devIdCounter } as unknown as T;
};

export const getNewIdentity = <T extends SelfIdentity | StateIdentity | StoreIdentity>() => {
    if (__DEV__) {
        return generateDevId<T>();
    }

    return Object.create(null) as T;
};

export const setCurrentContext = (id: SelfIdentity | null) => {
    e.currentContext = id;
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

export const reconcileEmits = (id: SelfIdentity, emits: Record<string, unknown> | undefined) => {
    if (!emits) {
        return;
    }

    if (!e.elementCache.has(id)) {
        e.elementCache.set(id, new ElementCache());
    }

    const cache = e.elementCache.get(id)!;
    const result: Record<string, unknown> = Object.create(null);

    for (const key in emits) {
        result[key] = (...args: unknown[]) => {
            const fn = cache.getLatest(key) as Function;
            if (__DEV__) {
                if (!fn) {
                    throw new Error(`Unable to find emit: ${key}`);
                }

                if (args.length > fn.length) {
                    __LOG__("warn", `Received ${args.length} arguments but expected ${fn.length}`);
                }
            }

            return fn?.(...args);
        };
    }

    cache.update(emits);
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

    public provide(): StateContainer<Data> {
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

export class ElementCache {
    #current: Record<string, unknown>;

    constructor() {
        this.#current = {};
    }

    public getLatest(key: string) {
        return this.#current[key];
    }

    public update(values: Record<string, unknown>) {
        this.#current = values;
    }
}

export const SlotGenerator = new Proxy({} as Record<string, EffectualSlotElement>, {
    get(target, p: string): EffectualSlotElement {
        return { kind: "slot", name: p };
    },
});

Object.freeze(SlotGenerator);
