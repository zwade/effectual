import { F, Store } from "@effectualjs/core";
import { Blog } from "./Blog.js";
import { Faq } from "./Faq.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { Progress } from "./Progress.js";
import { RerenderAction } from "./RerenderAction.js";
import { RerenderStatus } from "./RerenderCount.js";
import { RerenderLog } from "./RerenderLog.js";
export const Count = Store.create(0);
export const App = (props) => {
    const count = Count.$provide();
    const cachedCountValue = count.getValue();
    const onClick = () => {
        console.log("Previous count:", cachedCountValue);
        count.setValue(count.getValue() + 1);
    };
    return (F._jsx("div", { style: "font-family: sans-serif;" },
        F._jsx(Header, null),
        F._jsx(Blog, null),
        F._jsx(Progress, null),
        F._jsx(Faq, null),
        F._jsx("h2", null, "Reactivity Test"),
        F._jsx(RerenderAction, { className: "test-button", "$on:click": onClick, "$slot:cta": F._jsx("b", null, "Click to re-render") },
            F._jsx(RerenderStatus, null)),
        F._jsx(RerenderLog, null),
        F._jsx(Footer, null)));
};
//# sourceMappingURL=App.js.map