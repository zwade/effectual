import { createElement, fragmentId } from "./elements.mjs";

export { createElement, EffectualComponent, EffectualSourceElement, fragmentId, NativeElement } from "./elements.mjs";
export { expand } from "./expansion.mjs";
export {
    BaseHydrate,
    createHydrate,
    createTextHydrate,
    deleteHydrate,
    Hydrate,
    HydrateContext,
    NodeHydrate,
    processHydrate,
    RootHydrate,
    TextHydrate,
    updateHydrate,
    updateTextHydrate,
} from "./hydrates.mjs";
export {
    HTBaseNode,
    HTContentNode,
    HTNode,
    HTTextNode,
    HydrationTarget,
    OpaqueHTBaseNode,
    OpaqueHTContentNode,
    OpaqueHTNode,
    OpaqueHTTextNode,
    OpaqueHydrationTarget,
} from "./hydration-target.mjs";
export { MockHTContentNode, MockHTNode, MockHTTextNode } from "./mock-target.mjs";
export { fullyFlattenExpansion, reconcile, ReconciliationChild, ReconciliationEntry } from "./reconciler.mjs";
export { render } from "./render.mjs";

export const F = {
    _jsx: createElement,
    _fragment: fragmentId,
};
