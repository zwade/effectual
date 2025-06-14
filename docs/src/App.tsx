import { F, Store } from "@effectualjs/core";

import { Blog } from "./Blog.js";
import { Bugs } from "./Bugs.js";
import { Faq } from "./Faq.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { Progress } from "./Progress.js";
import { RerenderAction } from "./RerenderAction.js";
import { RerenderStatus } from "./RerenderCount.js";
import { RerenderLog } from "./RerenderLog.js";

export interface Props {}

export const Count = Store.create(0);

export const App = (props: Props) => {
    const count = Count.$provide();

    const cachedCountValue = count.getValue();
    const onClick = () => {
        console.log("Previous count:", cachedCountValue);
        count.setValue(count.getValue() + 1);
    };

    return (
        <div style="font-family: sans-serif;">
            <Header />

            <Bugs />

            <Blog />
            <Progress />
            <Faq />

            <h2>Reactivity Test</h2>

            <RerenderAction className="test-button" $on:click={onClick} $slot:cta={<b>Click to re-render</b>}>
                <RerenderStatus />
            </RerenderAction>
            <RerenderLog />

            <Footer />
        </div>
    );
};
