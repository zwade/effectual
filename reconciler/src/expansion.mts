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
    cleanupEffects,
    finalCleanup,
    getNewIdentity,
    isElementDirty,
    popCurrentStateContext,
    pushCurrentStateContext,
    reconcileEmits,
    resetCurrentContext,
    resetDependencyState,
    resetDirtyState,
    SelfIdentity,
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

export const childrenCompatible = (child: SingletonElement, oldChild: ExpansionEntry) => {
    if (typeof child !== "object") {
        return oldChild.kind === "text-node";
    }

    if (child === null) {
        return oldChild.kind === "omit";
    }

    return (
        (child.kind === "custom" && oldChild.kind === "child") ||
        (child.kind === "native" && oldChild.kind === "dom-element") ||
        (child.kind === "slot" && oldChild.kind === "slot-portal")
    );
};

/**
 * Takes the newly generated list of children and the previous list
 * and breaks it into two pieces:
 * `reconciledChildren` - The children that have been preserved from the previous expansion
 * `unreconciledChildren` - The children that no longer exist from the previous expansion
 */
export const partitionChildren = (element: EffectualElement, oldChildren: ExpansionChild[] = []) => {
    const flatChildren = flattenElement(element);
    const oldChildrenLookup = Object.fromEntries(oldChildren);

    const reconciledChildren = flatChildren.map(([key, child]) => {
        const foundChild = oldChildrenLookup[key];
        let oldChild: ExpansionEntry | undefined = undefined;

        if (foundChild && childrenCompatible(child, foundChild)) {
            oldChild = foundChild;
            delete oldChildrenLookup[key];
        }

        return [key, child, oldChild] as [string, SingletonElement, ExpansionEntry | undefined];
    });

    const unreconciledChildren = Object.entries(oldChildrenLookup);

    return { reconciledChildren, unreconciledChildren };
};

const deallocateElement = (element: ExpansionEntry) => {
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
        case "omit":
        case "text-node": {
            break;
        }
    }
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
            __LOG__("debug", "Instantiating", currentRoot, previousRoot);
            __TRIGGER__("expansion_new", currentRoot, context);
        }

        resetCurrentContext(identity);
        pushCurrentStateContext(identity);

        let instantiation: EffectualElement;
        try {
            const emits = reconcileEmits(identity, currentRoot.emits);
            instantiation = currentRoot.element(currentRoot.props ?? {}, { emits, slots: SlotGenerator });
            cleanupEffects();
        } catch (e) {
            __LOG__("error", e as any);
            instantiation = null;
        } finally {
            resetCurrentContext(null);
        }

        const { reconciledChildren, unreconciledChildren } = partitionChildren(instantiation, oldChildren);

        for (const [_key, child] of unreconciledChildren) {
            deallocateElement(child);
        }

        const result: ExpansionEntry = {
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
        let oldChildren: ExpansionChild[] | undefined = undefined;
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
        let oldChildren: ExpansionChild[] | undefined = undefined;
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
