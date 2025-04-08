import { F, Store } from "@effectualjs/core";
const Shown = Store.create(false);
export const FaqItem = (_props, ctx) => {
    const shown = Shown.$provide();
    return (F._jsx("div", { style: { marginBottom: "1rem", marginLeft: "1rem" } },
        F._jsx("div", null,
            F._jsx("h3", { style: { display: "inline-block", cursor: "pointer" }, "$on:click": (e) => {
                    shown.set((val) => !val);
                    e.preventDefault();
                } },
                shown.getValue() ? "⬇" : "⮕",
                " ",
                ctx.slots.title),
            shown.getValue() ? (F._jsx("div", null,
                F._jsx("slot", null))) : null)));
};
//# sourceMappingURL=FaqItem.js.map