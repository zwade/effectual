import { ExpansionEntry } from "./expansion.mjs";
import { HTContentNode, HTNode, HTTextNode, HydrationTarget } from "./hydration-target.mjs";

export type BaseHydrate = {
    parent: NodeHydrate | RootHydrate;
    right?: Hydrate;
    previous?: Hydrate;
    from: ExpansionEntry;
};

export type NodeHydrate = BaseHydrate & {
    kind: "node";
    node?: HTContentNode;
    from: ExpansionEntry & { kind: "dom-element" };
};

export type TextHydrate = BaseHydrate & {
    kind: "text";
    node?: HTTextNode;
    from: ExpansionEntry & { kind: "text-node" };
};

export type RootHydrate = {
    kind: "root";
    node: HTContentNode;
};

export type Hydrate = NodeHydrate | TextHydrate | RootHydrate;

export type HydrateContext = {
    target: HydrationTarget<any>;
    updateSchedule: Hydrate[];
    deletionSchedule: Hydrate[];
};

function insertSelf(hydrate: TextHydrate, element: HTTextNode): void;
function insertSelf(hydrate: NodeHydrate, element: HTContentNode): void;
function insertSelf(hydrate: TextHydrate | NodeHydrate, element: HTNode): void {
    if (__DEV__) {
        if (!hydrate.parent.node) {
            __LOG__("warn", "Unable to insert element", hydrate);
        }
    }

    if (hydrate.right?.node) {
        if (__DEV__) {
            __LOG__("info", "Inserting new node before element", hydrate.parent.node, hydrate.right.node, element);
        }
        hydrate.parent.node!.insertBefore(element, hydrate.right.node);
    } else {
        if (__DEV__) {
            __LOG__("info", "Inserting new node at end of element", hydrate.parent.node, element);
        }
        hydrate.parent.node!.appendChild(element);
    }

    // Lie for performance reasons
    // Normally we would need to do some sort of double casing, but we know
    // from the function signature that this must be correct
    (hydrate as NodeHydrate).node = element as HTContentNode;
}

export const createHydrate = (hydrate: NodeHydrate, context: HydrateContext) => {
    const element = context.target.createElement(hydrate.from.element.tag);
    const props = hydrate.from.element.props ?? {};

    for (const key in props) {
        if (props[key] !== undefined) {
            element.setAttribute(key, props[key]);
        }
    }

    insertSelf(hydrate, element);
};

export const updateHydrate = (hydrate: NodeHydrate, context: HydrateContext) => {
    if (hydrate.previous?.kind !== "node" || hydrate.from.element.tag !== hydrate.previous.from.element.tag) {
        context.deletionSchedule.push(hydrate.previous!);
        hydrate.previous = undefined;
        createHydrate(hydrate, context);
    } else {
        const existingSet = hydrate.previous.from.element.props ?? {};
        const newSet = hydrate.from.element.props ?? {};
        const element = hydrate.previous.node!;

        for (const key in existingSet) {
            if (!(key in newSet) || newSet[key] === undefined) {
                element.removeAttribute(key);
            } else if (newSet[key] !== existingSet[key]) {
                element.setAttribute(key, newSet[key]);
            }
        }

        for (const key in newSet) {
            if (!(key in existingSet) && newSet[key] !== undefined) {
                element.setAttribute(key, newSet[key]);
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

export const createTextHydrate = (hydrate: TextHydrate, context: HydrateContext) => {
    const element = context.target.createTextNode(hydrate.from.value);
    insertSelf(hydrate, element);
};

export const updateTextHydrate = (hydrate: TextHydrate, context: HydrateContext) => {
    if (hydrate.previous?.kind !== "text") {
        context.deletionSchedule.push(hydrate.previous!);
        hydrate.previous = undefined;
        createTextHydrate(hydrate, context);
    } else {
        const element = hydrate.previous.node!;

        element.textContent = hydrate.from.value;

        if (element.nextSibling !== (hydrate.right?.node ?? null)) {
            hydrate.parent.node?.removeChild(element);

            insertSelf(hydrate, element);
        }

        hydrate.node = element;
        hydrate.previous = undefined;
    }
};

export const processHydrate = (hydrate: Hydrate, context: HydrateContext) => {
    if (hydrate.kind === "node") {
        if (hydrate.previous !== undefined) {
            updateHydrate(hydrate, context);
        } else {
            createHydrate(hydrate, context);
        }
    } else if (hydrate.kind === "text") {
        if (hydrate.previous !== undefined) {
            updateTextHydrate(hydrate, context);
        } else {
            createTextHydrate(hydrate, context);
        }
    }
};

export const deleteHydrate = (hydrate: Hydrate, _context: HydrateContext) => {
    if (hydrate.kind === "node" || hydrate.kind === "text") {
        hydrate.parent.node?.removeChild(hydrate.node!);
    }
};
