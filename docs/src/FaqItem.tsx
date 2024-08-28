import { F, Store } from "@effectualjs/core";

const Shown = Store.create(false);

interface Slots {
    title: F.Element;
}

export const FaqItem = (_props: {}, ctx: F.Ctx<{ slots: Slots }>) => {
    const shown = Shown.$provide();

    return (
        <div style={{ marginBottom: "1rem", marginLeft: "1rem" }}>
            <div>
                <h3
                    style={{ display: "inline-block", cursor: "pointer" }}
                    $on:click={(e) => {
                        shown.set((val) => !val);
                        e.preventDefault();
                    }}
                >
                    {shown.getValue() ? "⬇" : "⮕"} {ctx.slots.title}
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
