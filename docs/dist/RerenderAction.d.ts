export interface Props {
    className?: string;
}
export interface Emits {
    click?: () => void;
}
export declare const RerenderAction: (props: Props, emits: Emits) => import("@effectualjs/reconciler/dist/elements.mjs").EffectualElement;
