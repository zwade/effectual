import { F } from "@effectualjs/core";

export interface Props {
    count: number;
}

export const RerenderStatus = (props: Props) => {
    return (
        <div class="header">
            This page has been rerendered {props.count} times.{" "}
            <button onclick="window.reconciler()">Click here to rerender.</button>
        </div>
    );
};
