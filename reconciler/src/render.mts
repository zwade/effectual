import { unreachable } from "@effectualjs/utils";

import { ExpansionEntry } from "./expansion.mjs";

/**
 * A helper function to render the expansion result as a string.
 * This will not be used beyond early debugging.
 */
export const render = (entry: ExpansionEntry): string => {
    if (entry.kind === "omit") {
        return "";
    }

    if (entry.kind === "text-node") {
        return entry.value;
    }

    if (entry.kind === "child") {
        return entry.result.map(([_key, value]) => render(value)).join("");
    }

    if (entry.kind === "slot-portal") {
        return entry.result.map(([_key, value]) => render(value)).join("");
    }

    if (entry.kind === "dom-element") {
        const children = entry.children.map(([_key, value]) => render(value)).join("");
        const props = Object.entries(entry.element.props ?? {})
            .filter(([_key, value]) => value !== undefined)
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ");

        let result = `<${entry.element.tag}${props ? ` ${props}` : ""}>`;
        result += children;
        result += `</${entry.element.tag}>`;

        return result;
    }

    return unreachable(entry);
};
