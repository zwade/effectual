import { F } from "@effectualjs/core";
import { Count } from "./App.js";
export const Footer = () => {
    const count = Count.$use();
    return F._jsx("div", null,
        "Copyright \u00A9",
        2024 + count,
        " Zach Wade");
};
//# sourceMappingURL=Footer.js.map