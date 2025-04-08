import { F } from "@effectualjs/core";
import { Count } from "./App.js";
export const RerenderStatus = (props) => {
    const count = Count.$use();
    return F._jsx("span", null,
        "This page has been rerendered ",
        count,
        " times. ");
};
//# sourceMappingURL=RerenderCount.js.map