import { F, Store } from "@effectualjs/core";

import { Bugs } from "./Bugs.js";

import "./index.css";

export interface Props {}

export const Count = Store.create(0);

export const App = (props: Props) => {
    return (
        <div>
            <Bugs />
        </div>
    );
};
