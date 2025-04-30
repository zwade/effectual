import { $effect, $state, F } from "@effectualjs/core";

export const Bugs = () => {
    const state = $state(0);

    const onClick = () => {
        state.set((val) => val + 1);
    };

    $effect(() => {
        console.log("Rerendered");
    });

    return (
        <div>
            <div>
                <div key="1">1</div>
                <div key="1">2</div>
            </div>
            <button $on:click={onClick}>Trigger</button>
        </div>
    );
};
