import { createElement, fragmentId } from "./elements.mjs";

export { createElement, EffectualComponent, EffectualSourceElement, fragmentId, NativeElement } from "./elements.mjs";
export { expand } from "./expansion.mjs";
export { render } from "./render.mjs";

export const F = {
    _jsx: createElement,
    _fragment: fragmentId,
};
