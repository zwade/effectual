import { F } from "@effectualjs/core";
import { FaqItem } from "./FaqItem.js";
export const Faq = () => {
    return (F._jsx(F._fragment, null,
        F._jsx("h2", null, "FAQ"),
        F._jsx(FaqItem, { "$slot:title": F._jsx("span", null,
                "Was this site ",
                F._jsx("i", null, "really"),
                " made with Effectual?") }, "Yep! Effectual is being built piecemeal, and with every new version of the framework comes a new version of this site to show off what it can do!"),
        F._jsx(FaqItem, { "$slot:title": "So what can it do?" }, "Uhhhh \u2014 this? Look it's a web page!"),
        F._jsx(FaqItem, { "$slot:title": "Why's it so ugly?" },
            "Ah yes well, I haven't added CSS support yet.",
            " ",
            F._jsx("sub", null, "Also it probably wouldn't look much better with it")),
        F._jsx(FaqItem, { "$slot:title": "How can I get started playing around with it?" },
            "Check out the github repository at",
            " ",
            F._jsx("a", { href: "https://github.com/zwade/effectual", target: "_blank" }, "github.com/zwade/effectual"),
            "!"),
        F._jsx(FaqItem, { "$slot:title": "Why did you make it?" },
            "As a way to both understand better how modern web frameworks work, and to help convey that knowledge to others.",
            F._jsx(FaqItem, { "$slot:title": "Ok but why did you realllllly make it?" },
                "Uhhhhh, I thought it would be a fun way to give back to the community",
                F._jsx(FaqItem, { "$slot:title": "..." }, "Ok ok I just wanted to look cool on twitter smh")))));
};
//# sourceMappingURL=Faq.js.map