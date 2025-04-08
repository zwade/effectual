import { F } from "@effectualjs/core";
const ProgressItem = (props) => {
    return (F._jsx("div", { style: "margin-left: 1rem; margin-bottom: 0.25rem;" },
        F._jsx("input", { type: "checkbox", checked: props.complete, disabled: true }),
        F._jsx("slot", null)));
};
export const Progress = () => (F._jsx(F._fragment, null,
    F._jsx("h2", null, "Effectual Progress"),
    F._jsx(ProgressItem, { complete: true }, "Render Engine"),
    F._jsx(ProgressItem, { complete: true }, "Reconciler"),
    F._jsx(ProgressItem, { complete: true }, "Reactivity Engine"),
    F._jsx(ProgressItem, null, "Effect Support"),
    F._jsx(ProgressItem, null, "Style Support"),
    F._jsx(ProgressItem, null, "Data Loading")));
//# sourceMappingURL=Progress.js.map