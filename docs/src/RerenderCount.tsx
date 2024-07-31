import { F } from "@effectualjs/core";

import { Count } from "./App.js";

export interface Props {}

export const RerenderStatus = (props: Props) => {
    const count = Count.use();
    return <span>This page has been rerendered {count} times. </span>;
};
