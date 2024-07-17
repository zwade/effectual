import {
    EffectualSourceElement,
    expand,
    F,
    reconcile,
    ReconciliationChild,
    render,
    RootHydrate,
} from "@effectualjs/core";
import { ExpansionEntry } from "@effectualjs/reconciler/dist/expansion.mjs";

import { App } from "./App.js";

const buildReconciliationLoop = (rootEl: HTMLElement) => {
    const root: RootHydrate = {
        kind: "root",
        node: rootEl,
    };

    let lastPass: ExpansionEntry | undefined = undefined;
    let lastReconciliation: ReconciliationChild[] | undefined = undefined;
    let count = 0;

    const reReconcile = () => {
        const nextPass = expand(<App count={count} />, lastPass);
        const nextReconciliation = reconcile(nextPass, root, document, lastReconciliation);

        lastPass = nextPass;
        lastReconciliation = nextReconciliation;
        count += 1;
    };

    return reReconcile;
};

const reconciler = buildReconciliationLoop(document.getElementById("root")!);
(window as any).reconciler = reconciler;
reconciler();
