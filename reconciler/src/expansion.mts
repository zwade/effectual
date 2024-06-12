import { unreachable } from "@effectualjs/utils";

import {
    EffectualElement,
    EffectualSlotElement,
    EffectualSourceElement,
    NativeElement,
    SingletonElement,
} from "./elements.mjs";
import { MemoEntry, memoItemsAreEqual, memoizeItem } from "./memo.mjs";

export type FragmentIsh = [Key: string | undefined, Value: ExpansionEntry];
export type ExpansionEntry =
    | {
          kind: "dom-element";
          memoKey: MemoEntry;
          element: NativeElement;
          children: FragmentIsh[];
      }
    | {
          kind: "child";
          memoKey: MemoEntry;
          element: EffectualSourceElement;
          result: FragmentIsh[];
      }
    | {
          kind: "slot-portal";
          element: EffectualSlotElement;
          result: FragmentIsh[];
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

const sourceElementIsUnchanged = (element: EffectualSourceElement, previousRoot: ExpansionSubroot) => {
    if (element.element !== previousRoot.element.element) {
        return false;
    }

    return memoItemsAreEqual(memoizeItem(element.props), previousRoot.memoKey);
};

const getKey = (element: EffectualElement): string | undefined => {
    if (element instanceof Object && !Array.isArray(element) && element.kind !== "fragment" && element.props?.key) {
        return "" + element.props.key;
    }
};

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

            const key = getKey(element) ?? `${currentPosition + i}`;
            acc.push([key, element]);
            continue;
        }

        acc.push([`${currentPosition + i}`, element]);
    }

    return acc;
};

const flattenElement = (element: EffectualElement): FlatElement[] => {
    if (Array.isArray(element)) {
        return flattenElements(element);
    }

    if (typeof element === "object" && element !== null && element.kind === "fragment") {
        return flattenElements(element.children);
    }

    return [[getKey(element) ?? "0", element]];
};

const expandClean = (element: ExpansionEntry, context: Context): ExpansionEntry => {
    if (__DEV__) {
        console.log(__LOG__);
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
        const isDirty = false; // TODO(zwade for zwade): Implement me

        if (isDirty) {
            return expandDirty(element.element, { ...context, previousRoot: element });
        }

        const newStack: LexicalScope[] = [{ element: element.element, clean: true }, ...context.lexicalScopeStack];

        return {
            kind: "child",
            element: element.element,
            memoKey: element.memoKey,
            result: element.result.map(([key, child]) => {
                const newContext: Context = { lexicalScopeStack: newStack, previousRoot: child };
                return [key, expandClean(child, newContext)];
            }),
        };
    }

    return unreachable(element);
};

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
        const isDirty = false; // TODO(zwade for zwade): Implement me
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
        let oldChildren: FragmentIsh[] | undefined = undefined;
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
        let oldChildren: FragmentIsh[] | undefined = undefined;
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
        let oldChildren: FragmentIsh[] | undefined = undefined;
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

export const expand = (currentRoot: EffectualElement, previousRoot?: ExpansionEntry): ExpansionEntry => {
    if (typeof currentRoot !== "object" || Array.isArray(currentRoot) || currentRoot?.kind !== "custom") {
        throw new Error("Root element must be a custom element");
    }

    return expandDirty(currentRoot, { lexicalScopeStack: [], previousRoot });
};
