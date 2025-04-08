import { expand, F, reconcile } from "@effectualjs/core";
import { App } from "./App.js";
const buildReconciliationLoop = (rootEl) => {
    const root = {
        kind: "root",
        node: rootEl,
    };
    let lastPass = undefined;
    let lastReconciliation = undefined;
    const reReconcile = () => {
        if (lastPass && !window.__effectual__.isDirty) {
            requestAnimationFrame(reReconcile);
            return;
        }
        const nextPass = expand(F._jsx(App, null), lastPass);
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
buildReconciliationLoop(document.getElementById("root"));
//# sourceMappingURL=index.js.map