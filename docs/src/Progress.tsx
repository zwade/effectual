import { F } from "@effectualjs/core";

interface ProgressItemProps {
    complete?: boolean;
}

const ProgressItem = (props: ProgressItemProps) => {
    return (
        <div style="margin-left: 1rem; margin-bottom: 0.25rem;">
            <input type="checkbox" checked={props.complete} disabled />
            <slot />
        </div>
    );
};

export const Progress = () => (
    <>
        <h2>Effectual Progress</h2>
        <ProgressItem complete>Render Engine</ProgressItem>
        <ProgressItem complete>Reconciler</ProgressItem>
        <ProgressItem complete>Reactivity Engine</ProgressItem>
        <ProgressItem>Effect Support</ProgressItem>
        <ProgressItem>Style Support</ProgressItem>
        <ProgressItem>Data Loading</ProgressItem>
    </>
);
