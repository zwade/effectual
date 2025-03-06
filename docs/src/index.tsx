import { expand, F, reconcile, ReconciliationChild, RootHydrate } from "@effectualjs/core";
import type { ExpansionEntry } from "@effectualjs/reconciler/dist/expansion.mjs";

import { App } from "./App.js";

const buildReconciliationLoop = (rootEl: HTMLElement) => {
    const root: RootHydrate = {
        kind: "root",
        node: rootEl,
    };

    let lastPass: ExpansionEntry | undefined = undefined;
    let lastReconciliation: ReconciliationChild[] | undefined = undefined;

    const reReconcile = () => {
        if (lastPass && !window.__effectual__.isDirty) {
            requestAnimationFrame(reReconcile);
            return;
        }

        const nextPass = expand(<App />, lastPass);
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

buildReconciliationLoop(document.getElementById("root")!);
