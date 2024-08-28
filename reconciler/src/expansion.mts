import { unreachable } from "@effectualjs/utils";

import {
    EffectualElement,
    EffectualSlotElement,
    EffectualSourceElement,
    NativeElement,
    SingletonElement,
} from "./elements.mjs";
import { MemoEntry, memoItemsAreEqual, memoizeItem } from "./memo.mjs";
import {
    getNewIdentity,
    isElementDirty,
    popCurrentStateContext,
    pushCurrentStateContext,
    reconcileEmits,
    resetDependencyState,
    resetDirtyState,
    SelfIdentity,
    setCurrentContext,
    SlotGenerator,
} from "./reactivity.mjs";

export type ExpansionChild = [Key: string, Value: ExpansionEntry];
export type ExpansionEntry =
    | {
          kind: "dom-element";
          memoKey: MemoEntry;
          element: NativeElement;
          children: ExpansionChild[];
          dirty: boolean;
      }
    | {
          kind: "child";
          memoKey: MemoEntry;
          element: EffectualSourceElement;
          result: ExpansionChild[];
          identity: SelfIdentity;
      }
    | {
          kind: "slot-portal";
          element: EffectualSlotElement;
          result: ExpansionChild[];
      }
    | { kind: "text-node"; value: string }
    | { kind: "omit" };

type ExpansionSubroot = ExpansionEntry & { kind: "child" };
type FlatElement = [Key: string, Value: SingletonElement];
type LexicalScope = { element: EffectualSourceElement; clean: boolean };

interface Context {
    previousRoot?: ExpansionEntry;
    lexicalScopeStack: LexicalScope[];
}

/**
 * Given a newly invoked source element and a previous expansion, determine whether
 * the new element would produce the same output as the previous element by checking the
 * memo state. (A comparison of the props and the element itself)
 */
const sourceElementIsUnchanged = (element: EffectualSourceElement, previousRoot: ExpansionSubroot) => {
    if (element.element !== previousRoot.element.element) {
        return false;
    }

    return memoItemsAreEqual(memoizeItem(element.props), previousRoot.memoKey);
};

/**
 * Find a key property on an element if it exists
 */
const getKey = (element: EffectualElement): string | undefined => {
    if (element instanceof Object && !Array.isArray(element) && element.kind !== "fragment" && element.props?.key) {
        return "" + element.props.key;
    }
};

/**
 * Given an arbitrarily deep tree of arrays and fragments, flatten it into a single list
 * of singelton elements (with optional associated keys).
 */
const flattenElements = (entry: EffectualElement[], acc: FlatElement[] = [], currentPosition = 0) => {
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

/**
 * Invokes `flattenElements` on a single element (casing on whether it's)
 * a singleton or not
 */
const flattenElement = (element: EffectualElement): FlatElement[] => {
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
const expandClean = (element: ExpansionEntry, context: Context): ExpansionEntry => {
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

    if (element.kind === "child") {
        const isDirty = isElementDirty(element.identity);

        if (isDirty) {
            return expandDirty(element.element, { ...context, previousRoot: element });
        }

        const newStack: LexicalScope[] = [{ element: element.element, clean: true }, ...context.lexicalScopeStack];

        return {
            kind: "child",
            element: element.element,
            memoKey: element.memoKey,
            identity: element.identity,
            result: element.result.map(([key, child]) => {
                const newContext: Context = { lexicalScopeStack: newStack, previousRoot: child };
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
const expandDirty = (currentRoot: SingletonElement, context: Context): ExpansionEntry => {
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

        const newStack: LexicalScope[] = [{ element: currentRoot, clean: false }, ...context.lexicalScopeStack];

        if (
            previousRoot &&
            previousRoot.kind === "child" &&
            sourceElementIsUnchanged(currentRoot, previousRoot) &&
            !isDirty
        ) {
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
        let oldChildren: ExpansionChild[] | undefined = undefined;
        let identity: SelfIdentity;
        if (previousRoot && previousRoot.kind === "child") {
            oldChildren = previousRoot.result;
            identity = previousRoot.identity;
        } else {
            identity = getNewIdentity();
        }

        if (__DEV__) {
            __LOG__("debug", "Instantiating", currentRoot);
            __TRIGGER__("expansion_new", currentRoot, context);
        }

        setCurrentContext(identity);
        pushCurrentStateContext(identity);

        let instantiation: EffectualElement;
        try {
            const emits = reconcileEmits(identity, currentRoot.emits);
            instantiation = currentRoot.element(currentRoot.props ?? {}, { emits, slots: SlotGenerator });
        } finally {
            setCurrentContext(null);
        }

        const result: ExpansionEntry = {
            kind: "child",
            element: currentRoot,
            identity,
            memoKey: memoizeItem(currentRoot.props),
            result: flattenElement(instantiation).map(([key, child]) => {
                const extantChild = oldChildren ? oldChildren.find(([k]) => k === key)?.[1] : undefined;
                return [key, expandDirty(child, { previousRoot: extantChild, lexicalScopeStack: newStack })];
            }),
        };

        popCurrentStateContext();
        return result;
    }

    if (currentRoot.kind === "native") {
        let oldChildren: ExpansionChild[] | undefined = undefined;
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
            dirty: true,
        };
    }

    if (currentRoot.kind === "slot") {
        let oldChildren: ExpansionChild[] | undefined = undefined;
        if (previousRoot && previousRoot.kind === "slot-portal") {
            oldChildren = previousRoot.result;
        }

        const children = context.lexicalScopeStack[0].element.children[currentRoot.name ?? "default"];
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
export const expand = (currentRoot: EffectualElement, previousRoot?: ExpansionEntry): ExpansionEntry => {
    if (typeof currentRoot !== "object" || Array.isArray(currentRoot) || currentRoot?.kind !== "custom") {
        throw new Error("Root element must be a custom element");
    }

    resetDependencyState();
    const result = expandDirty(currentRoot, { lexicalScopeStack: [], previousRoot });
    resetDirtyState();

    return result;
};
