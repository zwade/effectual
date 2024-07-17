import { F } from "@effectualjs/core";

import { Blog } from "./Blog.js";
import { Faq } from "./Faq.js";
import { Header } from "./Header.js";
import { Progress } from "./Progress.js";
import { RerenderStatus } from "./RerenderStatus.js";

export interface Props {
    count: number;
}

export const App = (props: Props) => {
    const sections = [<Blog key="blog" />, <Progress key="progress" />, <Faq key="faq" />];

    const toRender = [...sections.slice(props.count % 3), ...sections.slice(0, props.count % 3)];
    console.log(toRender);
    console.log("Rerendering");

    return (
        <div style="font-family: sans-serif;">
            <Header />
            <RerenderStatus count={props.count} />

            {toRender}
        </div>
    );
};
