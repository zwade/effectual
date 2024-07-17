import { expand, F, OpaqueHydrationTarget, reconcile, RootHydrate } from "@effectualjs/core";
import { EffectualSourceElement } from "@effectualjs/reconciler/dist/elements.mjs";
import { MockHydrationTarget } from "@effectualjs/reconciler/dist/mock-target.mjs";

import { A, C, D } from "./fixtures.js";

const firstElement = <A first />;
const secondElement = <A />;

__HOOK__("expansion_new", (root: EffectualSourceElement, previousRoot: any) => {
    console.log("Rerendering", root.element, root.props);
});

const target: OpaqueHydrationTarget = MockHydrationTarget;
const rootNode = target.createElement("div");
rootNode.setAttribute("id", "root");

const root: RootHydrate = {
    kind: "root",
    node: rootNode,
};

const originalPass = expand(firstElement);
const originalReconciliation = reconcile(originalPass, root, target);

console.log(originalReconciliation[0][1].node.node?.toString());

console.log("-------------");

const secondPass = expand(secondElement, originalPass);
const secondReconciliation = reconcile(secondPass, root, target, originalReconciliation);

console.log(secondReconciliation[0][1].node.node?.toString());
