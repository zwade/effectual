import { F } from "./elements.mjs";
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
    from: ExpansionEntry & { kind: "dom-element" | "teleport" };
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

const setAttribute = (element: HTContentNode, key: string, value: unknown, previousValue?: unknown) => {
    if (key.startsWith("$on:") && typeof value === "function") {
        const eventName = key.slice(4).toLowerCase();

        if (typeof previousValue === "function") {
            element.removeEventListener(eventName, previousValue as () => void);
        }

        element.addEventListener(eventName, value as () => void);
        return;
    }

    if (typeof value === "object" && key === "style") {
        element.style.cssText = "";

        for (const [k, v] of Object.entries(value as Record<string, string>)) {
            if (!k.startsWith("--")) {
                element.style[k as keyof F.CSSStyles] = v;
            } else {
                element.style.setProperty(k, v);
            }
        }

        return;
    }

    if (element.tagName === "INPUT" && key === "value") {
        // element.setAttribute("value", value) doesn't actually change the content of the element
        // Note that this will fail for mock-target so it's going to mess up the test suite a bit
        (element as any).value = value as string;
        return;
    }

    if ((typeof value === "string" || typeof value === "number") && !key.startsWith("$")) {
        element.setAttribute(key, value.toString());
        return;
    }

    if (typeof value === "boolean" || typeof value === "undefined" || value === null) {
        if (value) {
            element.setAttribute(key, "");
        } else if (previousValue) {
            element.removeAttribute(key);
        }

        return;
    }

    if (__DEV__) {
        __LOG__("info", "Unassignable prop", key, value);
    }
};

export const createHydrate = (hydrate: NodeHydrate, context: HydrateContext) => {
    if (__DEV__) {
        __LOG__("info", "create_hydrate", hydrate);
        __TRIGGER__("create_hydrate", hydrate, context);
    }

    if (hydrate.from.element.kind === "portal") {
        hydrate.node = hydrate.from.element.element as HTContentNode;
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

export const updateHydrate = (hydrate: NodeHydrate, context: HydrateContext) => {
    if (hydrate.from.element.kind === "portal") {
        hydrate.node = hydrate.from.element.element as HTContentNode;
        if (hydrate.previous?.kind !== "node" || hydrate.previous.from.element.kind !== "portal") {
            context.deletionSchedule.push(hydrate.previous!);
            hydrate.previous = undefined;
            createHydrate(hydrate, context);
            return;
        }

        // Portals don't get updated
        return;
    }

    if (
        hydrate.previous?.kind !== "node" ||
        hydrate.previous.from.kind !== "dom-element" ||
        hydrate.from.element.tag !== hydrate.previous.from.element.tag
    ) {
        context.deletionSchedule.push(hydrate.previous!);
        hydrate.previous = undefined;
        createHydrate(hydrate, context);
    } else {
        if (__DEV__) {
            __LOG__("info", "update_hydrate", hydrate);
            __TRIGGER__("update_hydrate", hydrate, context);
        }

        const existingSet = hydrate.previous.from.element.props ?? {};
        const newSet = hydrate.from.element.props ?? {};
        const element = hydrate.previous.node!;

        for (const key in existingSet) {
            if (!(key in newSet) || newSet[key] === undefined) {
                element.removeAttribute(key);
            } else if (newSet[key] !== existingSet[key]) {
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

export const createTextHydrate = (hydrate: TextHydrate, context: HydrateContext) => {
    if (__DEV__) {
        __LOG__("info", "creating_text_hydrate", hydrate);
        __TRIGGER__("create_text_hydrate", hydrate, context);
    }

    const element = context.target.createTextNode(hydrate.from.value);
    insertSelf(hydrate, element);
};

export const updateTextHydrate = (hydrate: TextHydrate, context: HydrateContext) => {
    if (hydrate.previous?.kind !== "text") {
        context.deletionSchedule.push(hydrate.previous!);
        hydrate.previous = undefined;
        createTextHydrate(hydrate, context);
    } else {
        if (__DEV__) {
            __LOG__("info", "update_text_hydrate", hydrate);
            __TRIGGER__("update_text_hydrate", hydrate, context);
        }

        const element = hydrate.previous.node!;
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

        hydrate.parent.node?.removeChild(hydrate.node!);
    }
};
