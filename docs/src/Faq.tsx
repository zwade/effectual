import { F } from "@effectualjs/core";

import { FaqItem } from "./FaqItem.js";

export const Faq = () => {
    return (
        <>
            <h2>FAQ</h2>
            <FaqItem
                $slot:title={
                    <span>
                        Was this site <i>really</i> made with Effectual?
                    </span>
                }
            >
                Yep! Effectual is being built piecemeal, and with every new version of the framework comes a new version
                of this site to show off what it can do!
            </FaqItem>
            <FaqItem $slot:title="So what can it do?">Uhhhh &mdash; this? Look it's a web page!</FaqItem>
            <FaqItem $slot:title="Why's it so ugly?">
                Ah yes well, I haven't added CSS support yet.{" "}
                <sub>Also it probably wouldn't look much better with it</sub>
            </FaqItem>
            <FaqItem $slot:title="How can I get started playing around with it?">
                Check out the github repository at{" "}
                <a href="https://github.com/zwade/effectual" target="_blank">
                    github.com/zwade/effectual
                </a>
                !
            </FaqItem>
        </>
    );
};
