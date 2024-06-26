import { F } from "@effectualjs/core";

import { Blog } from "./Blog.js";
import { Faq } from "./Faq.js";
import { Header } from "./Header.js";
import { Progress } from "./Progress.js";

export interface Props {}

export const App = (props: Props) => {
    return (
        <div style="font-family: sans-serif;">
            <Header />
            <Blog />
            <Progress />
            <Faq />
        </div>
    );
};
