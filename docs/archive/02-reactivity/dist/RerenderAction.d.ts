import { F } from "@effectualjs/core";
export interface Props {
    className?: string;
}
export interface Emits {
    click?: () => void;
}
export interface Slots {
    cta: F.Element;
}
export declare const RerenderAction: (props: Props, ctx: {
    emits: Emits;
    slots: Slots;
}) => import("@effectualjs/reconciler/dist/elements.mjs").EffectualElement;
