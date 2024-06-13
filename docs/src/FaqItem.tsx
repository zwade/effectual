import { F } from "@effectualjs/core";

interface Props {
    title: string;
}

export const FaqItem = (props: Props) => {
    return (
        <div style="margin-bottom: 1rem; margin-left: 1rem;">
            <details open>
                <summary>
                    <h3 style="display: inline-block">{props.title}</h3>
                </summary>
                <div>
                    <slot />
                </div>
            </details>
        </div>
    );
};
