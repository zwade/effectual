import { F, Store } from "@effectualjs/core";

interface Props {
    title: string;
}

const Shown = Store.create(true);

export const FaqItem = (props: Props) => {
    const shown = Shown.provide();

    return (
        <div style={{ marginBottom: "1rem", marginLeft: "1rem", cursor: "pointer" }}>
            <div
                open={shown.getValue()}
                $on:click={(e) => {
                    shown.set((val) => !val);
                    e.preventDefault();
                }}
            >
                <h3 style={{ display: "inline-block" }}>
                    {shown.getValue() ? "⬇" : "⮕"} {props.title}
                </h3>

                {shown.getValue() ? (
                    <div>
                        <slot />
                    </div>
                ) : null}
            </div>
        </div>
    );
};
