function createElement(tag, props, ...children) {
    if (tag === fragmentId) {
        return {
            kind: "fragment",
            children,
        };
    }
    if (tag === "slot") {
        return {
            kind: "slot",
        };
    }
    if (typeof tag === "function") {
        return {
            kind: "custom",
            element: tag,
            props: props ?? undefined,
            children,
        };
    }
    return {
        kind: "native",
        tag,
        props: props ?? undefined,
        children,
    };
}
const fragmentId = Symbol.for("fragment");

// Mimicing react's pattern here
// The general idea is that once we're ready to build an actual bundle
// We hardcode __DEV__ to true or false which lets deadcode elimination
// remove any unreachable code
globalThis.__DEV__ = true;
globalThis.__LOG_LEVEL__ = "warn";
globalThis.__HOOK__ = () => {};
globalThis.__UNHOOK__ = () => {};
if (__DEV__) {
    globalThis.__ASSERT__ = (condition, message) => {
        if (!condition) {
            throw new Error(message);
        }
    };
    globalThis.__effectual__ = {
        hooks: new Map(),
    };
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
        } else {
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
        if (order[level] >= order[__LOG_LEVEL__]) ;
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
            const key = getKey(element) ?? `${currentPosition + i}`;
            acc.push([key, element]);
            continue;
        }
        acc.push([`${currentPosition + i}`, element]);
    }
    return acc;
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
        };
    }
    if (element.kind === "slot-portal") {
        return expandDirty(element.element, { ...context, previousRoot: element });
    }
    if (element.kind === "child") {
        const newStack = [{ element: element.element, clean: true }, ...context.lexicalScopeStack];
        return {
            kind: "child",
            element: element.element,
            memoKey: element.memoKey,
            result: element.result.map(([key, child]) => {
                const newContext = { lexicalScopeStack: newStack, previousRoot: child };
                return [key, expandClean(child, newContext)];
            }),
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
        const isDirty = false; // TODO(zwade for zwade): Implement me
        const newStack = [{ element: currentRoot, clean: false }, ...context.lexicalScopeStack];
        if (previousRoot &&
            previousRoot.kind === "child" &&
            sourceElementIsUnchanged(currentRoot, previousRoot) &&
            !isDirty) {
            if (__DEV__) {
                __LOG__("debug", "Reusing", currentRoot);
                __TRIGGER__("expansion_reuse", currentRoot, context);
            }
            return {
                kind: "child",
                element: currentRoot,
                memoKey: previousRoot.memoKey,
                result: previousRoot.result.map(([key, child]) => [
                    key,
                    expandClean(child, { previousRoot: child, lexicalScopeStack: newStack }),
                ]),
            };
        }
        if (__DEV__) {
            __LOG__("debug", "Instantiating", currentRoot);
            __TRIGGER__("expansion_new", currentRoot, context);
        }
        const instantiation = currentRoot.element(currentRoot.props ?? {});
        // This code is repeated thrice -- how do i abstract it out?
        let oldChildren = undefined;
        if (previousRoot && previousRoot.kind === "child") {
            oldChildren = previousRoot.result;
        }
        return {
            kind: "child",
            element: currentRoot,
            memoKey: memoizeItem(currentRoot.props),
            result: flattenElement(instantiation).map(([key, child]) => {
                const extantChild = oldChildren ? oldChildren.find(([k]) => k === key)?.[1] : undefined;
                return [key, expandDirty(child, { previousRoot: extantChild, lexicalScopeStack: newStack })];
            }),
        };
    }
    if (currentRoot.kind === "native") {
        let oldChildren = undefined;
        if (previousRoot && previousRoot.kind === "dom-element") {
            oldChildren = previousRoot.children;
        }
        return {
            kind: "dom-element",
            memoKey: memoizeItem(currentRoot.props),
            element: currentRoot,
            children: flattenElement(currentRoot.children).map(([key, child]) => {
                const extantChild = oldChildren ? oldChildren.find(([k]) => k === key)?.[1] : undefined;
                return [key, expandDirty(child, { ...context, previousRoot: extantChild })];
            }),
        };
    }
    if (currentRoot.kind === "slot") {
        let oldChildren = undefined;
        if (previousRoot && previousRoot.kind === "slot-portal") {
            oldChildren = previousRoot.result;
        }
        const children = context.lexicalScopeStack[0].element.children;
        const contextWasClean = context.lexicalScopeStack[0].clean;
        const newStack = context.lexicalScopeStack.slice(1);
        return {
            kind: "slot-portal",
            element: currentRoot,
            result: flattenElement(children).map(([key, child]) => {
                const extantChild = oldChildren ? oldChildren.find(([k]) => k === key)?.[1] : undefined;
                if (__DEV__) {
                    if (contextWasClean) {
                        __ASSERT__(extantChild !== undefined, "A clean context should not be able to rewire children");
                    }
                }
                if (contextWasClean && extantChild) {
                    return [key, expandClean(extantChild, { lexicalScopeStack: newStack, previousRoot: extantChild })];
                }
                return [key, expandDirty(child, { lexicalScopeStack: newStack, previousRoot: extantChild })];
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
    return expandDirty(currentRoot, { lexicalScopeStack: [], previousRoot });
};

/**
 * A helper function to render the expansion result as a string.
 * This will not be used beyond early debugging.
 */
const render = (entry, indent = 0) => {
    if (entry.kind === "omit") {
        return "";
    }
    if (entry.kind === "text-node") {
        return "    ".repeat(indent) + entry.value + "\n";
    }
    if (entry.kind === "child") {
        return entry.result.map(([_key, value]) => render(value, indent)).join("");
    }
    if (entry.kind === "slot-portal") {
        return entry.result.map(([_key, value]) => render(value, indent)).join("");
    }
    if (entry.kind === "dom-element") {
        const children = entry.children.map(([_key, value]) => render(value, indent + 1)).join("");
        const props = Object.entries(entry.element.props ?? {})
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ");
        let result = "    ".repeat(indent) + `<${entry.element.tag} ${props}>\n`;
        result += children;
        result += "    ".repeat(indent) + `</${entry.element.tag}>\n`;
        return result;
    }
    return unreachable(entry);
};

const F = {
    _jsx: createElement,
    _fragment: fragmentId,
};

const Blog = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h2", null, "Blog Posts"),
        F._jsx("ul", null,
            F._jsx("li", null, "Whoops nothing here"))));
};

const FaqItem = (props) => {
    return (F._jsx("div", { style: "margin-bottom: 1rem; margin-left: 1rem;" },
        F._jsx("details", { open: true },
            F._jsx("summary", null,
                F._jsx("h3", { style: "display: inline-block" }, props.title)),
            F._jsx("div", null,
                F._jsx("slot", null)))));
};

const Faq = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h2", null, "FAQ"),
        F._jsx(FaqItem, { title: "Was this site really made with Effectual?" }, "Yep! Effectual is being built piecemeal, and with every new version of the framework comes a new version of this site to show off what it can do!"),
        F._jsx(FaqItem, { title: "So what can it do?" }, "Uhhhh \u2014 this? Look it's a web page!"),
        F._jsx(FaqItem, { title: "Why's it so ugly?" },
            "Ah yes well, I haven't added CSS support yet.",
            " ",
            F._jsx("sub", null, "Also it probably wouldn't look much better with it")),
        F._jsx(FaqItem, { title: "How can I get started playing around with it?" },
            "Check out the github repository at",
            " ",
            F._jsx("a", { href: "https://github.com/zwade/effectual", target: "_blank" }, "github.com/zwade/effectual"),
            "!")));
};

const Header = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h1", null, "Effectual Web Development"),
        F._jsx("hr", null),
        "This site was made with ",
        F._jsx("a", { href: "https://github.com/zwade/effectual" }, "Effectual JS"),
        ", an educational (and functional!) web development framework."));
};

const App = (props) => {
    return (F._jsx("div", { style: "font-family: sans-serif;" },
        F._jsx(Header, null),
        F._jsx(Blog, null),
        F._jsx(Faq, null)));
};

const expanded = expand(F._jsx(App, null));
const rendered = render(expanded);
console.log(expanded);
console.log(rendered);
document.getElementById("root").innerHTML = rendered;
