import { F } from "@effectualjs/core";
export const Blog = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h2", null, "Blog Posts"),
        F._jsx("ul", null,
            F._jsx("li", null,
                F._jsx("a", { href: "https://dttw.tech/posts/WPLtwgai6", target: "_blank" }, "Part 0: Build your own Framework")),
            F._jsx("li", null,
                F._jsx("a", { href: "https://dttw.tech/posts/Bn_yOwnTo", target: "_blank" }, "Part 1: Rend(er) me Asunder")))));
};
//# sourceMappingURL=Blog.js.map