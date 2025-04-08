import { F } from "@effectualjs/core";
export const Header = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h1", null, "Effectual Web Development"),
        F._jsx("hr", null),
        "This site was made with ",
        F._jsx("a", { href: "https://github.com/zwade/effectual" }, "Effectual JS"),
        ", an educational (and functional!) web development framework."));
};
//# sourceMappingURL=Header.js.map