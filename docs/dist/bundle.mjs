function createElement(tag, attrs, ...children) {
    if (tag === fragmentId) {
        return {
            kind: "fragment",
            children,
        };
    }
    if (tag === "slot") {
        return {
            kind: "slot",
            name: attrs?.name ?? undefined,
            props: attrs ?? undefined,
        };
    }
    if (tag === "portal") {
        return {
            kind: "portal",
            element: attrs?.element,
            props: undefined,
            children,
        };
    }
    if (typeof tag === "function") {
        const props = {};
        const emits = {};
        const allChildren = {};
        let hasEmits = false;
        for (const key in attrs) {
            if (key.startsWith("$on:")) {
                emits[key.slice(4)] = attrs[key];
                hasEmits = true;
            }
            else if (key.startsWith("$slot:")) {
                allChildren[key.slice(6)] = attrs[key];
            }
            else {
                props[key] = attrs[key];
            }
        }
        if (children.length > 0) {
            allChildren["default"] = children;
        }
        return {
            kind: "custom",
            element: tag,
            props,
            emits: hasEmits ? emits : undefined,
            children: allChildren,
        };
    }
    return {
        kind: "native",
        tag,
        props: attrs ?? undefined,
        children,
    };
}
const fragmentId = Symbol.for("fragment");
const F = {
    _jsx: createElement,
    _fragment: fragmentId,
};

// Mimicing react's pattern here
// The general idea is that once we're ready to build an actual bundle
// We hardcode __DEV__ to true or false which lets deadcode elimination
// remove any unreachable code
globalThis.__DEV__ = true;
globalThis.__LOG_LEVEL__ = "warn";
globalThis.__HOOK__ = () => { };
globalThis.__UNHOOK__ = () => { };
globalThis.__effectual__ ??= {};
if (__DEV__) {
    globalThis.__ASSERT__ = (condition, message) => {
        if (!condition) {
            throw new Error(message);
        }
    };
    globalThis.__effectual__.hooks = new Map();
    globalThis.__TRIGGER__ = (hook, ...args) => {
        const callbacks = globalThis.__effectual__.hooks.get(hook);
        if (callbacks !== undefined) {
            for (const callback of callbacks) {
                callback(...args);
            }
        }
    };
    globalThis.__HOOK__ = (hook, callback) => {
        const callbacks = globalThis.__effectual__.hooks.get(hook);
        if (callbacks !== undefined) {
            callbacks.add(callback);
        }
        else {
            globalThis.__effectual__.hooks.set(hook, new Set([callback]));
        }
    };
    globalThis.__UNHOOK__ = (hook, callback) => {
        const callbacks = globalThis.__effectual__.hooks.get(hook);
        if (callbacks !== undefined) {
            callbacks.delete(callback);
        }
    };
    globalThis.__LOG__ = (level, message, ...args) => {
        const order = { debug: 0, info: 1, warn: 2, error: 3 };
        if (order[level] >= order[__LOG_LEVEL__]) {
            console.warn(`${level}:`, message, ...args);
        }
    };
}

/**
 * A function that helps prove that a function can never reach a certain point
 *
 * ```ts
 * const doSomething = (value: string | number) => {
 *   if (typeof value === "string") return ...;
 *   if (typeof value === "number") return ...;
 *
 *   return unreachable(value);
 * }
 * ```
 */
const unreachable = (value) => {
    console.warn("Unreachable", value);
    throw new Error(`Unreachable: ${value}`);
};

const memoizeSingleObject = (value) => {
    if ((typeof value === "object" || typeof value === "function") && value !== null) {
        return new WeakRef(value);
    }
    return value;
};
/**
 * Given a set of props, we compute a memoization array that
 * lists out key value pairs for the purpose of memoization.
 *
 * In the event that the values are objects, we cache them
 * in weak references to avoid memory leaks.
 */
const memoizeItem = (props) => {
    const cacheObject = [];
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
/**
 * Compares two memoization sets and returns whether they are equivalent
 * or not. For objects, equivalence is determined by reference equality.
 */
const memoItemsAreEqual = (a, b) => {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i][0] !== b[i][0]) {
            return false;
        }
        const aValue = a[i][1];
        const bValue = b[i][1];
        if (aValue instanceof WeakRef && bValue instanceof WeakRef) {
            if (aValue.deref() !== bValue.deref() || aValue.deref() === undefined) {
                return false;
            }
        }
        else if (aValue !== bValue) {
            return false;
        }
    }
    return true;
};

class GenerationalMap {
    map = new Map();
    generation = 0;
    generationList = [];
    set(key, value) {
        this.generationList.push({ generation: this.generation, key, previous: this.map.get(key) });
        this.map.set(key, value);
    }
    get(key) {
        return this.map.get(key);
    }
    pushGeneration() {
        this.generation += 1;
    }
    popGeneration() {
        const gen = this.generation;
        this.generation -= 1;
        let i = this.generationList.length - 1;
        for (; i >= 0; i--) {
            const el = this.generationList[i];
            if (el.generation === gen) {
                if (el.previous) {
                    this.map.set(el.key, el.previous);
                }
                else {
                    this.map.delete(el.key);
                }
            }
        }
        this.generationList.splice(i + 1);
    }
}

const e = (globalThis.__effectual__ ??= {});
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
const generateDevId = () => {
    e._devIdCounter += 1;
    return { id: e._devIdCounter };
};
const getNewIdentity = () => {
    if (__DEV__) {
        return generateDevId();
    }
    return Object.create(null);
};
const resetCurrentContext = (id) => {
    e.currentContext = id;
    if (id) {
        e.effectCount = 0;
    }
};
const pushCurrentStateContext = (id) => {
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
const popCurrentStateContext = () => {
    if (!e.currentStateContext) {
        return;
    }
    e.currentStateContext.popGeneration();
};
const resetDependencyState = () => {
    e.currentStateContext = new GenerationalMap();
};
const resetDirtyState = () => {
    e.dirtySet = new Set();
    e.isDirty = false;
};
const cleanupEffects = () => {
    if (e.effectCache.has(e.currentContext)) {
        const cache = e.effectCache.get(e.currentContext);
        for (const [key, effect] of cache) {
            if (!effect.executed) {
                effect.cleanup();
                cache.remove(key);
            }
            else {
                effect.executed = false;
            }
        }
    }
};
const finalCleanup = (identity) => {
    const cache = e.effectCache.get(identity);
    if (cache) {
        for (const [, effect] of cache) {
            effect.cleanup();
        }
    }
    e.effectCache.delete(identity);
};
const reconcileEmits = (id, emits) => {
    if (!emits) {
        return {};
    }
    if (!e.effectCache.has(id)) {
        e.effectCache.set(id, new ElementCache());
    }
    const cache = e.effectCache.get(id);
    const result = Object.create(null);
    for (const key in emits) {
        if (!cache.has(key)) {
            cache.add(key, new EmitEffectContainer());
        }
        const container = cache.getLatest(key);
        result[key] = container.cachedFn;
        container.lastResult = emits[key];
        container.executed = true;
    }
    return result;
};
const isElementDirty = (id) => {
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
class BaseStore {
    id;
    default;
    constructor(default_) {
        this.id = getNewIdentity();
        this.default = default_;
    }
    $provide() {
        const element = e.currentContext;
        if (!e.stateMap.has(element)) {
            e.stateMap.set(element, new Map());
        }
        if (e.stateMap.get(element)?.has(this.id)) {
            return new StateContainer(e.stateMap.get(element)?.get(this.id));
        }
        const container = new _StateContainer(this.default);
        e.stateMap.get(element)?.set(this.id, container);
        e.currentStateContext?.set(this.id, container);
        return new StateContainer(container);
    }
    useContainer() {
        const container = e.currentStateContext?.get(this.id);
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
class _StateContainer {
    #currentValue;
    #nextValue;
    #dirty = false;
    #stateId;
    constructor(default_) {
        this.#currentValue = default_;
        this.#nextValue = default_;
        this.#stateId = getNewIdentity();
    }
    setValue(value) {
        this.#nextValue = value;
        if (!this.#dirty) {
            e.dirtySet.add(this.#stateId);
            this.#dirty = true;
            e.isDirty = true;
        }
    }
    getValue() {
        if (e.currentEffect) {
            e.currentEffect.addDependency(this.#stateId);
        }
        if (e.currentContext) {
            if (!e.dependencyMap.has(e.currentContext)) {
                e.dependencyMap.set(e.currentContext, new Set());
            }
            e.dependencyMap.get(e.currentContext)?.add(this.#stateId);
        }
        return this.#currentValue;
    }
    getNextValue() {
        return this.#nextValue;
    }
    tick() {
        if (this.#dirty) {
            this.#dirty = false;
            this.#currentValue = this.#nextValue;
        }
    }
    get id() {
        return this.#stateId;
    }
    toString() {
        return `StateContainer(dirty=${this.#dirty}, current=${this.#currentValue}, next=${this.#nextValue})`;
    }
}
class StateContainer {
    #base;
    constructor(container) {
        this.#base = container;
    }
    get value() {
        return this.getValue();
    }
    getValue() {
        return this.#base.getValue();
    }
    set(cb) {
        this.#base.setValue(cb(this.#base.getNextValue()));
    }
    setValue(value) {
        return this.#base.setValue(value);
    }
}
class ElementCache {
    #current;
    constructor() {
        this.#current = {};
    }
    has(key) {
        // eslint-disable-next-line no-prototype-builtins
        return this.#current.hasOwnProperty(key);
    }
    getLatest(key) {
        return this.#current[key];
    }
    merge(values) {
        for (const [key, value] of Object.entries(values)) {
            this.#current[key] = value;
        }
    }
    add(key, value) {
        this.#current[key] = value;
    }
    remove(key) {
        delete this.#current[key];
    }
    [Symbol.iterator]() {
        return Object.entries(this.#current)[Symbol.iterator]();
    }
}
class BaseEffectContainer {
    lastResult;
    executed = false;
}
class EmitEffectContainer extends BaseEffectContainer {
    cachedFn;
    constructor() {
        super();
        this.cachedFn = (...args) => {
            const fn = this.lastResult;
            if (__DEV__) {
                if (args.length > fn.length) {
                    __LOG__("warn", `Received ${args.length} arguments but expected ${fn.length}`);
                }
            }
            return fn?.(...args);
        };
    }
    cleanup() {
        // Nothing to do
    }
}
const SlotGenerator = new Proxy({}, {
    get(target, p) {
        return { kind: "slot", name: p };
    },
});
Object.freeze(SlotGenerator);

/**
 * Given a newly invoked source element and a previous expansion, determine whether
 * the new element would produce the same output as the previous element by checking the
 * memo state. (A comparison of the props and the element itself)
 */
const sourceElementIsUnchanged = (element, previousRoot) => {
    if (element.element !== previousRoot.element.element) {
        return false;
    }
    return memoItemsAreEqual(memoizeItem(element.props), previousRoot.memoKey);
};
/**
 * Find a key property on an element if it exists
 */
const getKey = (element) => {
    if (element instanceof Object && !Array.isArray(element) && element.kind !== "fragment" && element.props?.key) {
        return "" + element.props.key;
    }
};
/**
 * Given an arbitrarily deep tree of arrays and fragments, flatten it into a single list
 * of singelton elements (with optional associated keys).
 */
const flattenElements = (entry, acc = [], currentPosition = 0) => {
    for (let i = 0; i < entry.length; i++) {
        const element = entry[i];
        if (typeof element === "object" && element !== null) {
            if (Array.isArray(element)) {
                flattenElements(element, acc, currentPosition + i);
                continue;
            }
            if (element.kind === "fragment") {
                flattenElements(element.children, acc, currentPosition + i);
                continue;
            }
            const key = getKey(element) ?? `__static_${currentPosition + i}`;
            acc.push([key, element]);
            continue;
        }
        acc.push([`__static_${currentPosition + i}`, element]);
    }
    return acc;
};
const childrenCompatible = (child, oldChild) => {
    if (typeof child !== "object") {
        return oldChild.kind === "text-node";
    }
    if (child === null) {
        return oldChild.kind === "omit";
    }
    return ((child.kind === "custom" && oldChild.kind === "child") ||
        (child.kind === "native" && oldChild.kind === "dom-element") ||
        (child.kind === "slot" && oldChild.kind === "slot-portal"));
};
/**
 * Takes the newly generated list of children and the previous list
 * and breaks it into two pieces:
 * `reconciledChildren` - The children that have been preserved from the previous expansion
 * `unreconciledChildren` - The children that no longer exist from the previous expansion
 */
const partitionChildren = (element, oldChildren = []) => {
    const flatChildren = flattenElement(element);
    const oldChildrenLookup = Object.fromEntries(oldChildren);
    const reconciledChildren = flatChildren.map(([key, child]) => {
        const foundChild = oldChildrenLookup[key];
        let oldChild = undefined;
        if (foundChild && childrenCompatible(child, foundChild)) {
            oldChild = foundChild;
            delete oldChildrenLookup[key];
        }
        return [key, child, oldChild];
    });
    const unreconciledChildren = Object.entries(oldChildrenLookup);
    return { reconciledChildren, unreconciledChildren };
};
const deallocateElement = (element) => {
    switch (element.kind) {
        case "dom-element": {
            for (const [, child] of element.children) {
                deallocateElement(child);
            }
            break;
        }
        case "child": {
            for (const [, child] of element.result) {
                deallocateElement(child);
            }
            finalCleanup(element.identity);
            break;
        }
        case "slot-portal": {
            for (const [, child] of element.result) {
                deallocateElement(child);
            }
            break;
        }
    }
};
/**
 * Invokes `flattenElements` on a single element (casing on whether it's)
 * a singleton or not
 */
const flattenElement = (element) => {
    if (Array.isArray(element)) {
        return flattenElements(element);
    }
    if (typeof element === "object" && element !== null && element.kind === "fragment") {
        return flattenElements(element.children);
    }
    return [[getKey(element) ?? "0", element]];
};
/**
 * The clean co-recursive component to the expansion function. This function starts it's
 * entrypoint at the location of a custom element that is unchanged from the previous expansion.
 * This function will then load the cached expansion tree and recurse down it, preserving all state
 * until it encounters an element that's been explicitly marked as dirty. Once found, it will
 * co-recurse back to the dirty expansion function.
 *
 * Note, for slot expansion we use the dirtyness state of the lexical scope under which the slot
 * was defined. This is because that scope will determine whether the associated children could
 * possible have been changed.
 */
const expandClean = (element, context) => {
    if (__DEV__) {
        __LOG__("debug", "Expand clean", element);
        __TRIGGER__("expand_clean", element, context);
    }
    if (element.kind === "text-node" || element.kind === "omit") {
        return element;
    }
    if (element.kind === "dom-element") {
        return {
            kind: "dom-element",
            memoKey: element.memoKey,
            element: element.element,
            children: element.children.map(([key, child]) => [key, expandClean(child, context)]),
            dirty: false,
        };
    }
    if (element.kind === "slot-portal") {
        return expandDirty(element.element, { ...context, previousRoot: element });
    }
    if (element.kind === "teleport") {
        return expandDirty(element.element, { ...context, previousRoot: element });
    }
    if (element.kind === "child") {
        const isDirty = isElementDirty(element.identity);
        if (isDirty) {
            return expandDirty(element.element, { ...context, previousRoot: element });
        }
        const newStack = [{ element: element.element, clean: true }, ...context.lexicalScopeStack];
        pushCurrentStateContext(element.identity);
        const children = element.result.map(([key, child]) => {
            const newContext = { lexicalScopeStack: newStack, previousRoot: child };
            return [key, expandClean(child, newContext)];
        });
        popCurrentStateContext();
        return {
            kind: "child",
            element: element.element,
            memoKey: element.memoKey,
            identity: element.identity,
            result: children,
        };
    }
    return unreachable(element);
};
/**
 * The dirty co-recursive component to the expansion function, and the main default entrypoint
 * for expansion itself.
 *
 * This method takes a Singleton element and then compares it to the previously rendered node
 * it corresponds to. If it's able to determine that these are unchanged, and if the element
 * has not been marked as dirty, then it will switch it's execution to the clean path.
 *
 * If the element is dirty, then it will re-invoke the element to create a new subtree, and
 * will attempt to reconcile those subtrees with the previous expansion (using the key property).
 */
const expandDirty = (currentRoot, context) => {
    if (__DEV__) {
        __LOG__("debug", "Expand", currentRoot, context.previousRoot);
        __TRIGGER__("expand_dirty", currentRoot, context);
    }
    const { previousRoot } = context;
    switch (typeof currentRoot) {
        case "boolean":
        case "number":
        case "string":
            return {
                kind: "text-node",
                value: "" + currentRoot,
            };
    }
    if (currentRoot === null || currentRoot === undefined) {
        return {
            kind: "omit",
        };
    }
    if (currentRoot.kind === "custom") {
        const isDirty = previousRoot?.kind === "child" && isElementDirty(previousRoot.identity);
        const newStack = [{ element: currentRoot, clean: false }, ...context.lexicalScopeStack];
        if (previousRoot &&
            previousRoot.kind === "child" &&
            sourceElementIsUnchanged(currentRoot, previousRoot) &&
            !isDirty) {
            if (__DEV__) {
                __LOG__("debug", "Reusing", currentRoot);
                __TRIGGER__("expansion_reuse", currentRoot, context);
            }
            reconcileEmits(previousRoot.identity, currentRoot.emits);
            return {
                kind: "child",
                element: currentRoot,
                identity: previousRoot.identity,
                memoKey: previousRoot.memoKey,
                result: previousRoot.result.map(([key, child]) => [
                    key,
                    expandClean(child, { previousRoot: child, lexicalScopeStack: newStack }),
                ]),
            };
        }
        // This code is repeated thrice -- how do i abstract it out?
        let oldChildren = undefined;
        let identity;
        if (previousRoot && previousRoot.kind === "child") {
            oldChildren = previousRoot.result;
            identity = previousRoot.identity;
        }
        else {
            identity = getNewIdentity();
        }
        if (__DEV__) {
            __LOG__("debug", "Instantiating", currentRoot, previousRoot);
            __TRIGGER__("expansion_new", currentRoot, context);
        }
        resetCurrentContext(identity);
        pushCurrentStateContext(identity);
        let instantiation;
        try {
            const emits = reconcileEmits(identity, currentRoot.emits);
            instantiation = currentRoot.element(currentRoot.props ?? {}, { emits, slots: SlotGenerator });
            cleanupEffects();
        }
        catch (e) {
            __LOG__("error", e);
            instantiation = null;
        }
        finally {
            resetCurrentContext(null);
        }
        const { reconciledChildren, unreconciledChildren } = partitionChildren(instantiation, oldChildren);
        for (const [_key, child] of unreconciledChildren) {
            deallocateElement(child);
        }
        const result = {
            kind: "child",
            element: currentRoot,
            identity,
            memoKey: memoizeItem(currentRoot.props),
            result: reconciledChildren.map(([key, child, extantChild]) => {
                return [key, expandDirty(child, { previousRoot: extantChild, lexicalScopeStack: newStack })];
            }),
        };
        popCurrentStateContext();
        return result;
    }
    if (currentRoot.kind === "native") {
        let oldChildren = undefined;
        if (previousRoot && previousRoot.kind === "dom-element") {
            oldChildren = previousRoot.children;
        }
        const { reconciledChildren, unreconciledChildren } = partitionChildren(currentRoot.children, oldChildren);
        for (const [_key, child] of unreconciledChildren) {
            deallocateElement(child);
        }
        return {
            kind: "dom-element",
            memoKey: memoizeItem(currentRoot.props),
            element: currentRoot,
            children: reconciledChildren.map(([key, child, extantChild]) => {
                return [key, expandDirty(child, { ...context, previousRoot: extantChild })];
            }),
            dirty: true,
        };
    }
    if (currentRoot.kind === "slot") {
        let oldChildren = undefined;
        if (previousRoot && previousRoot.kind === "slot-portal") {
            oldChildren = previousRoot.result;
        }
        const children = context.lexicalScopeStack[0].element.children[currentRoot.name ?? "default"];
        const contextWasClean = context.lexicalScopeStack[0].clean;
        const newStack = context.lexicalScopeStack.slice(1);
        const { reconciledChildren, unreconciledChildren } = partitionChildren(children, oldChildren);
        for (const [_key, child] of unreconciledChildren) {
            deallocateElement(child);
        }
        return {
            kind: "slot-portal",
            element: currentRoot,
            result: reconciledChildren.map(([key, child, extantChild]) => {
                if (__DEV__) {
                    if (contextWasClean) {
                        __ASSERT__(extantChild !== undefined || child === undefined, "A clean context should not be able to rewire children");
                    }
                }
                if (contextWasClean && extantChild) {
                    return [key, expandClean(extantChild, { lexicalScopeStack: newStack, previousRoot: extantChild })];
                }
                return [key, expandDirty(child, { lexicalScopeStack: newStack, previousRoot: extantChild })];
            }),
        };
    }
    if (currentRoot.kind === "portal") {
        let oldChildren = undefined;
        if (previousRoot && previousRoot.kind === "teleport") {
            oldChildren = previousRoot.children;
        }
        const children = currentRoot.children;
        const { reconciledChildren, unreconciledChildren } = partitionChildren(children, oldChildren);
        for (const [_key, child] of unreconciledChildren) {
            deallocateElement(child);
        }
        return {
            kind: "teleport",
            memoKey: memoizeItem(currentRoot.props),
            dirty: true,
            element: currentRoot,
            children: reconciledChildren.map(([key, child, extantChild]) => {
                return [key, expandDirty(child, { ...context, previousRoot: extantChild })];
            }),
        };
    }
    return unreachable(currentRoot);
};
/**
 * Expand takes an invocation of a custom component (and optionally a previously expanded subtree)
 * and returns a new expansion tree, reusing the previous tree wherever possible.
 */
const expand = (currentRoot, previousRoot) => {
    if (typeof currentRoot !== "object" || Array.isArray(currentRoot) || currentRoot?.kind !== "custom") {
        throw new Error("Root element must be a custom element");
    }
    resetDependencyState();
    const result = expandDirty(currentRoot, { lexicalScopeStack: [], previousRoot });
    resetDirtyState();
    return result;
};

function insertSelf(hydrate, element) {
    if (__DEV__) {
        if (!hydrate.parent.node) {
            __LOG__("warn", "Unable to insert element", hydrate);
        }
    }
    if (hydrate.right?.node) {
        if (__DEV__) {
            __LOG__("info", "Inserting new node before element", hydrate.parent.node, hydrate.right.node, element);
        }
        hydrate.parent.node.insertBefore(element, hydrate.right.node);
    }
    else {
        if (__DEV__) {
            __LOG__("info", "Inserting new node at end of element", hydrate.parent.node, element);
        }
        hydrate.parent.node.appendChild(element);
    }
    // Lie for performance reasons
    // Normally we would need to do some sort of double casing, but we know
    // from the function signature that this must be correct
    hydrate.node = element;
}
const setAttribute = (element, key, value, previousValue) => {
    if (key.startsWith("$on:") && typeof value === "function") {
        const eventName = key.slice(4).toLowerCase();
        if (typeof previousValue === "function") {
            element.removeEventListener(eventName, previousValue);
        }
        element.addEventListener(eventName, value);
        return;
    }
    if (typeof value === "object" && key === "style") {
        element.style.cssText = "";
        for (const [k, v] of Object.entries(value)) {
            if (!k.startsWith("--")) {
                element.style[k] = v;
            }
            else {
                element.style.setProperty(k, v);
            }
        }
        return;
    }
    if (element.tagName === "INPUT" && key === "value") {
        // element.setAttribute("value", value) doesn't actually change the content of the element
        // Note that this will fail for mock-target so it's going to mess up the test suite a bit
        element.value = value;
        return;
    }
    if ((typeof value === "string" || typeof value === "number") && !key.startsWith("$")) {
        element.setAttribute(key, value.toString());
        return;
    }
    if (typeof value === "boolean" || typeof value === "undefined" || value === null) {
        if (value) {
            element.setAttribute(key, "");
        }
        else if (previousValue) {
            element.removeAttribute(key);
        }
        return;
    }
    if (__DEV__) {
        __LOG__("info", "Unassignable prop", key, value);
    }
};
const createHydrate = (hydrate, context) => {
    if (__DEV__) {
        __LOG__("info", "create_hydrate", hydrate);
        __TRIGGER__("create_hydrate", hydrate, context);
    }
    if (hydrate.from.element.kind === "portal") {
        hydrate.node = hydrate.from.element.element;
        return;
    }
    const hydrateSrc = hydrate.from.element;
    const element = context.target.createElement(hydrateSrc.tag);
    const props = hydrate.from.element.props ?? {};
    for (const key in props) {
        if (props[key] !== undefined) {
            setAttribute(element, key, props[key]);
        }
    }
    insertSelf(hydrate, element);
};
const updateHydrate = (hydrate, context) => {
    if (hydrate.from.element.kind === "portal") {
        hydrate.node = hydrate.from.element.element;
        if (hydrate.previous?.kind !== "node" || hydrate.previous.from.element.kind !== "portal") {
            context.deletionSchedule.push(hydrate.previous);
            hydrate.previous = undefined;
            createHydrate(hydrate, context);
            return;
        }
        // Portals don't get updated
        return;
    }
    if (hydrate.previous?.kind !== "node" ||
        hydrate.previous.from.kind !== "dom-element" ||
        hydrate.from.element.tag !== hydrate.previous.from.element.tag) {
        context.deletionSchedule.push(hydrate.previous);
        hydrate.previous = undefined;
        createHydrate(hydrate, context);
    }
    else {
        if (__DEV__) {
            __LOG__("info", "update_hydrate", hydrate);
            __TRIGGER__("update_hydrate", hydrate, context);
        }
        const existingSet = hydrate.previous.from.element.props ?? {};
        const newSet = hydrate.from.element.props ?? {};
        const element = hydrate.previous.node;
        for (const key in existingSet) {
            if (!(key in newSet) || newSet[key] === undefined) {
                element.removeAttribute(key);
            }
            else if (newSet[key] !== existingSet[key]) {
                setAttribute(element, key, newSet[key], existingSet[key]);
            }
        }
        for (const key in newSet) {
            if (!(key in existingSet) && newSet[key] !== undefined) {
                setAttribute(element, key, newSet[key]);
            }
        }
        if (element.nextSibling !== (hydrate.right?.node ?? null)) {
            hydrate.parent.node?.removeChild(element);
            insertSelf(hydrate, element);
        }
        hydrate.previous = undefined; // We need to make sure we can GC
        hydrate.node = element;
    }
};
const createTextHydrate = (hydrate, context) => {
    if (__DEV__) {
        __LOG__("info", "creating_text_hydrate", hydrate);
        __TRIGGER__("create_text_hydrate", hydrate, context);
    }
    const element = context.target.createTextNode(hydrate.from.value);
    insertSelf(hydrate, element);
};
const updateTextHydrate = (hydrate, context) => {
    if (hydrate.previous?.kind !== "text") {
        context.deletionSchedule.push(hydrate.previous);
        hydrate.previous = undefined;
        createTextHydrate(hydrate, context);
    }
    else {
        if (__DEV__) {
            __LOG__("info", "update_text_hydrate", hydrate);
            __TRIGGER__("update_text_hydrate", hydrate, context);
        }
        const element = hydrate.previous.node;
        if (hydrate.previous.from.value !== hydrate.from.value) {
            element.textContent = hydrate.from.value;
            if (element.nextSibling !== (hydrate.right?.node ?? null)) {
                hydrate.parent.node?.removeChild(element);
                insertSelf(hydrate, element);
            }
        }
        hydrate.node = element;
        hydrate.previous = undefined;
    }
};
const processHydrate = (hydrate, context) => {
    if (hydrate.kind === "node") {
        if (hydrate.previous !== undefined) {
            updateHydrate(hydrate, context);
        }
        else {
            createHydrate(hydrate, context);
        }
    }
    else if (hydrate.kind === "text") {
        if (hydrate.previous !== undefined) {
            updateTextHydrate(hydrate, context);
        }
        else {
            createTextHydrate(hydrate, context);
        }
    }
};
const deleteHydrate = (hydrate, _context) => {
    if (hydrate.kind === "node" || hydrate.kind === "text") {
        if (hydrate.from.kind === "teleport") {
            // We're not allowed to delete the teleport node directly
            // So instead we just delete its children
            if (hydrate.kind === "node") {
                for (const child of hydrate.node?.children ?? []) {
                    hydrate.node?.removeChild(child);
                }
            }
            return;
        }
        hydrate.parent.node?.removeChild(hydrate.node);
    }
};

class Store extends BaseStore {
    $use() {
        const container = this.useContainer();
        if (container) {
            return container.getValue();
        }
        return this.default;
    }
    static create(default_) {
        return new Store(default_);
    }
}

const fullyFlattenExpansion = (children, keyPrefix = "", acc = []) => {
    for (let i = 0; i < children.length; i++) {
        const [key = i.toString(), child] = children[i];
        switch (child.kind) {
            case "dom-element":
            case "text-node":
            case "teleport": {
                acc.push([keyPrefix + key, child]);
                break;
            }
            case "child":
            case "slot-portal": {
                fullyFlattenExpansion(child.result, keyPrefix + key + "\x00", acc);
                break;
            }
        }
    }
    return acc;
};
const reconcileChildren = (children, context) => {
    const previousElementsByKey = Object.create(null);
    if (context.previousLevel) {
        for (const [key, child] of context.previousLevel) {
            previousElementsByKey[key] = child;
        }
    }
    let rightSibling = undefined;
    const newChildren = [];
    for (let i = children.length - 1; i >= 0; i--) {
        const [key, child] = children[i];
        const previousChild = previousElementsByKey[key];
        delete previousElementsByKey[key];
        let newNode = rightSibling;
        switch (child.kind) {
            case "teleport":
            case "dom-element": {
                const isClean = !child.dirty && previousChild?.kind === "dom-element";
                const parent = {
                    kind: "node",
                    parent: context.parent,
                    previous: previousChild?.node,
                    from: child,
                    right: rightSibling,
                    node: isClean ? previousChild?.node.node : undefined,
                };
                const flatChildren = fullyFlattenExpansion(child.children);
                const previousChildren = previousChild?.kind === "dom-element" ? previousChild.children : undefined;
                if (!isClean) {
                    // Only bother re-processing if something changed
                    context.updateSchedule.push(parent);
                }
                const newChild = reconcileChildren(flatChildren, {
                    parent,
                    updateSchedule: context.updateSchedule,
                    deletionSchedule: context.deletionSchedule,
                    previousLevel: previousChildren,
                });
                newChildren.push([
                    key,
                    {
                        kind: "dom-element",
                        children: newChild,
                        element: child.element,
                        memoKey: child.memoKey,
                        node: parent,
                    },
                ]);
                if (child.kind === "dom-element") {
                    newNode = parent;
                }
                break;
            }
            case "text-node": {
                newNode = {
                    kind: "text",
                    parent: context.parent,
                    previous: previousChild?.node,
                    from: child,
                    right: rightSibling,
                };
                newChildren.push([
                    key,
                    {
                        kind: "text-node",
                        node: newNode,
                    },
                ]);
                context.updateSchedule.push(newNode);
                break;
            }
        }
        rightSibling = newNode;
    }
    for (const key in previousElementsByKey) {
        context.deletionSchedule.push(previousElementsByKey[key].node);
    }
    return newChildren;
};
const reconcile = (entry, rootHydrate, target, previousRun) => {
    const updateSchedule = [];
    const deletionSchedule = [];
    const children = reconcileChildren(fullyFlattenExpansion([["root", entry]]), {
        parent: rootHydrate,
        updateSchedule,
        deletionSchedule,
        previousLevel: previousRun,
    });
    const hydrateContext = { updateSchedule, deletionSchedule, target };
    while (updateSchedule.length > 0) {
        const next = updateSchedule.shift();
        processHydrate(next, hydrateContext);
    }
    while (deletionSchedule.length > 0) {
        deleteHydrate(deletionSchedule.shift());
    }
    return children;
};

const Blog = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h2", null, "Blog Posts"),
        F._jsx("ul", null,
            F._jsx("li", null,
                F._jsx("a", { href: "https://dttw.tech/posts/WPLtwgai6", target: "_blank" }, "Part 0: Build your own Framework")),
            F._jsx("li", null,
                F._jsx("a", { href: "https://dttw.tech/posts/Bn_yOwnTo", target: "_blank" }, "Part 1: Rend(er) me Asunder")))));
};

const Shown = Store.create(false);
const FaqItem = (_props, ctx) => {
    const shown = Shown.$provide();
    return (F._jsx("div", { style: { marginBottom: "1rem", marginLeft: "1rem" } },
        F._jsx("div", null,
            F._jsx("h3", { style: { display: "inline-block", cursor: "pointer" }, "$on:click": (e) => {
                    shown.set((val) => !val);
                    e.preventDefault();
                } },
                shown.getValue() ? "⬇" : "⮕",
                " ",
                ctx.slots.title),
            shown.getValue() ? (F._jsx("div", null,
                F._jsx("slot", null))) : null)));
};

const Faq = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h2", null, "FAQ"),
        F._jsx(FaqItem, { "$slot:title": F._jsx("span", null,
                "Was this site ",
                F._jsx("i", null, "really"),
                " made with Effectual?") }, "Yep! Effectual is being built piecemeal, and with every new version of the framework comes a new version of this site to show off what it can do!"),
        F._jsx(FaqItem, { "$slot:title": "So what can it do?" }, "Uhhhh \u2014 this? Look it's a web page!"),
        F._jsx(FaqItem, { "$slot:title": "Why's it so ugly?" },
            "Ah yes well, I haven't added CSS support yet.",
            " ",
            F._jsx("sub", null, "Also it probably wouldn't look much better with it")),
        F._jsx(FaqItem, { "$slot:title": "How can I get started playing around with it?" },
            "Check out the github repository at",
            " ",
            F._jsx("a", { href: "https://github.com/zwade/effectual", target: "_blank" }, "github.com/zwade/effectual"),
            "!"),
        F._jsx(FaqItem, { "$slot:title": "Why did you make it?" },
            "As a way to both understand better how modern web frameworks work, and to help convey that knowledge to others.",
            F._jsx(FaqItem, { "$slot:title": "Ok but why did you realllllly make it?" },
                "Uhhhhh, I thought it would be a fun way to give back to the community",
                F._jsx(FaqItem, { "$slot:title": "..." }, "Ok ok I just wanted to look cool on twitter smh")))));
};

const Footer = () => {
    const count = Count.$use();
    return F._jsx("div", null,
        "Copyright \u00A9",
        2024 + count,
        " Zach Wade");
};

const Header = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h1", null, "Effectual Web Development"),
        F._jsx("hr", null),
        "This site was made with ",
        F._jsx("a", { href: "https://github.com/zwade/effectual" }, "Effectual JS"),
        ", an educational (and functional!) web development framework."));
};

const ProgressItem = (props) => {
    return (F._jsx("div", { style: "margin-left: 1rem; margin-bottom: 0.25rem;" },
        F._jsx("input", { type: "checkbox", checked: props.complete, disabled: true }),
        F._jsx("slot", null)));
};
const Progress = () => (F._jsx(F._fragment, null,
    F._jsx("h2", null, "Effectual Progress"),
    F._jsx(ProgressItem, { complete: true }, "Render Engine"),
    F._jsx(ProgressItem, { complete: true }, "Reconciler"),
    F._jsx(ProgressItem, { complete: true }, "Reactivity Engine"),
    F._jsx(ProgressItem, null, "Effect Support"),
    F._jsx(ProgressItem, null, "Style Support"),
    F._jsx(ProgressItem, null, "Data Loading")));

const RerenderAction = (props, ctx) => {
    return (F._jsx("div", { class: `${props.className ?? ""} rerender-action` },
        F._jsx("slot", null),
        F._jsx("button", { "$on:click": () => ctx.emits.click?.() },
            F._jsx("slot", { name: "cta" }))));
};

const RerenderStatus = (props) => {
    const count = Count.$use();
    return F._jsx("span", null,
        "This page has been rerendered ",
        count,
        " times. ");
};

const LogStore = Store.create([]);
const RerenderLog = () => {
    const log = LogStore.$provide();
    // This is a huge hack since we don't have effects yet
    if (!window.hasHooked) {
        window.hasHooked = true;
        __HOOK__("expansion_new", (root) => {
            if (root.element !== RerenderLog) {
                console.log(root.element.name);
                // We can't actually change state while inside of a hook, because we're mid render
                // at this point so we'll update the state but then get marked as clean
                // In the future i'd like for renderers to be able to make state changes, but that's low pri
                setTimeout(() => log.set((log) => [
                    ...log,
                    `Rerendered ${new Date().toLocaleTimeString()}: ${root.element.name};`,
                ]), 0);
            }
        });
    }
    return (F._jsx("div", null,
        F._jsx("h3", null, "Rerender Log"),
        F._jsx("div", { style: {
                height: "10rem",
                border: "1px solid black",
                borderRadius: "8px",
                overflow: "scroll",
                marginBottom: "1rem",
            } },
            F._jsx("div", { style: { display: "flex", flexFlow: "column-reverse", padding: "0.5rem" } }, log.getValue().map((value, i) => (F._jsx("div", { key: i }, value)))))));
};

const Count = Store.create(0);
const App = (props) => {
    const count = Count.$provide();
    const cachedCountValue = count.getValue();
    const onClick = () => {
        console.log("Previous count:", cachedCountValue);
        count.setValue(count.getValue() + 1);
    };
    return (F._jsx("div", { style: "font-family: sans-serif;" },
        F._jsx(Header, null),
        F._jsx(Blog, null),
        F._jsx(Progress, null),
        F._jsx(Faq, null),
        F._jsx("h2", null, "Reactivity Test"),
        F._jsx(RerenderAction, { className: "test-button", "$on:click": onClick, "$slot:cta": F._jsx("b", null, "Click to re-render") },
            F._jsx(RerenderStatus, null)),
        F._jsx(RerenderLog, null),
        F._jsx(Footer, null)));
};

const buildReconciliationLoop = (rootEl) => {
    const root = {
        kind: "root",
        node: rootEl,
    };
    let lastPass = undefined;
    let lastReconciliation = undefined;
    const reReconcile = () => {
        if (lastPass && !window.__effectual__.isDirty) {
            requestAnimationFrame(reReconcile);
            return;
        }
        const nextPass = expand(F._jsx(App, null), lastPass);
        const nextReconciliation = reconcile(nextPass, root, document, lastReconciliation);
        lastPass = nextPass;
        lastReconciliation = nextReconciliation;
        requestAnimationFrame(reReconcile);
    };
    requestAnimationFrame(reReconcile);
};
// __LOG_LEVEL__ = "info";
__HOOK__("expansion_new", (root) => {
    __LOG__("info", "Expanding element", root.element.name);
});
buildReconciliationLoop(document.getElementById("root"));
