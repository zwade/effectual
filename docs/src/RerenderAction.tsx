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

export const RerenderAction = (props: Props, ctx: { emits: Emits; slots: Slots }) => {
    return (
        <div class={`${props.className ?? ""} rerender-action`}>
            <slot />
            <button $on:click={() => ctx.emits.click?.()}>
                <slot name="cta" />
            </button>
        </div>
    );
};
