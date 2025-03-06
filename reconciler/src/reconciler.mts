import { NativeElement } from "./elements.mjs";
import { ExpansionChild, ExpansionEntry } from "./expansion.mjs";
import {
    deleteHydrate,
    Hydrate,
    HydrateContext,
    NodeHydrate,
    processHydrate,
    RootHydrate,
    TextHydrate,
} from "./hydrates.mjs";
import { OpaqueHydrationTarget } from "./hydration-target.mjs";
import { MemoEntry } from "./memo.mjs";

export type ReconciliationChild = [Key: string, Value: ReconciliationEntry];
export type ReconciliationEntry =
    | {
          kind: "dom-element";
          memoKey: MemoEntry;
          element: NativeElement;
          children: ReconciliationChild[];
          node: NodeHydrate;
      }
    | {
          kind: "text-node";
          node: TextHydrate;
      };

interface Context {
    parent: NodeHydrate | RootHydrate;
    leftSibling?: Hydrate;
    previousLevel?: ReconciliationChild[];
    updateSchedule: Hydrate[];
    deletionSchedule: Hydrate[];
}

type ExpansionReconciliationAtom = ExpansionEntry & { kind: "dom-element" | "text-node" };
type ExpansionDomChild = [Key: string, Value: ExpansionReconciliationAtom];

export const fullyFlattenExpansion = (
    children: ExpansionChild[],
    keyPrefix = "",
    acc: ExpansionDomChild[] = [],
): ExpansionDomChild[] => {
    for (let i = 0; i < children.length; i++) {
        const [key = i.toString(), child] = children[i];

        switch (child.kind) {
            case "dom-element":
            case "text-node": {
                acc.push([keyPrefix + key, child]);
                break;
            }
            case "child":
            case "slot-portal": {
                fullyFlattenExpansion(child.result, keyPrefix + key + "\x00", acc);
                break;
            }
            case "omit": {
                break;
            }
        }
    }

    return acc;
};

const reconcileChildren = (children: ExpansionDomChild[], context: Context): ReconciliationChild[] => {
    const previousElementsByKey = Object.create(null) as Record<string, ReconciliationEntry>;

    if (context.previousLevel) {
        for (const [key, child] of context.previousLevel) {
            previousElementsByKey[key] = child;
        }
    }

    let rightSibling: Hydrate | undefined = undefined;
    const newChildren: ReconciliationChild[] = [];

    for (let i = children.length - 1; i >= 0; i--) {
        const [key, child] = children[i];

        const previousChild = previousElementsByKey[key] as ReconciliationEntry | undefined;
        delete previousElementsByKey[key];

        let newNode: Hydrate;
        if (child.kind === "dom-element") {
            const isClean = !child.dirty && previousChild?.kind === "dom-element";

            const parent: NodeHydrate = {
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

            newNode = parent;
        } else {
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
        }

        rightSibling = newNode;
    }

    for (const key in previousElementsByKey) {
        context.deletionSchedule.push(previousElementsByKey[key].node);
    }

    return newChildren;
};

export const reconcile = (
    entry: ExpansionEntry,
    rootHydrate: RootHydrate,
    target: OpaqueHydrationTarget,
    previousRun?: ReconciliationChild[],
): ReconciliationChild[] => {
    const updateSchedule: Hydrate[] = [];
    const deletionSchedule: Hydrate[] = [];

    const children = reconcileChildren(fullyFlattenExpansion([["root", entry]]), {
        parent: rootHydrate,
        updateSchedule,
        deletionSchedule,
        previousLevel: previousRun,
    });

    const hydrateContext: HydrateContext = { updateSchedule, deletionSchedule, target };

    while (updateSchedule.length > 0) {
        const next = updateSchedule.shift()!;
        processHydrate(next, hydrateContext);
    }

    while (deletionSchedule.length > 0) {
        deleteHydrate(deletionSchedule.shift()!, hydrateContext);
    }

    return children;
};
