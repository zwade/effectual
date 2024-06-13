import { F } from "@effectualjs/core";

export interface Props {}

export const App = (props: Props) => {
    return (
        <div style="font-family: sans-serif;">
            <h1>Effectual Web Development</h1>
            <hr />
            This site was made with <a href="https://github.com/zwade/effectual">Effectual JS</a>, an educational (and
            functional!) web development framework.
        </div>
    );
};
