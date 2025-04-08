import { F } from "@effectualjs/core";
export const RerenderAction = (props, ctx) => {
    return (F._jsx("div", { class: `${props.className ?? ""} rerender-action` },
        F._jsx("slot", null),
        F._jsx("button", { "$on:click": () => ctx.emits.click?.() },
            F._jsx("slot", { name: "cta" }))));
};
//# sourceMappingURL=RerenderAction.js.map