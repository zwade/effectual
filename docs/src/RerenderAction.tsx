import { F } from "@effectualjs/core";

export interface Props {
    className?: string;
}

export interface Emits {
    click?: () => void;
}

export const RerenderAction = (props: Props, emits: Emits) => {
    return (
        <div class={`${props.className ?? ""} rerender-action`}>
            <button $on:click={() => emits.click?.()}>
                <slot />
            </button>
        </div>
    );
};
