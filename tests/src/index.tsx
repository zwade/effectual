import { expand, F, render } from "@effectualjs/core";
import { EffectualSourceElement, SingletonElement } from "@effectualjs/reconciler/dist/elements.mjs";
import { A } from "./fixtures.js";

const firstElement = <A first />;
const secondElement = <A />;

__HOOK__("expansion_new", (root: EffectualSourceElement, previousRoot: any) => {
    console.log("Rerendering", root.element, root.props);
});

const originalPass = expand(firstElement);

console.log(render(originalPass));

console.log("-------------");

const secondPass = expand(secondElement, originalPass);

console.log(render(secondPass));
