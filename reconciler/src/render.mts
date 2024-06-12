import { unreachable } from "@effectualjs/utils";

import { ExpansionEntry } from "./expansion.mjs";

export const render = (entry: ExpansionEntry, indent = 0): string => {
    if (entry.kind === "omit") {
        return "";
    }

    if (entry.kind === "text-node") {
        return "    ".repeat(indent) + entry.value + "\n";
    }

    if (entry.kind === "child") {
        return entry.result.map(([_key, value]) => render(value, indent)).join("");
    }

    if (entry.kind === "slot-portal") {
        return entry.result.map(([_key, value]) => render(value, indent)).join("");
    }

    if (entry.kind === "dom-element") {
        const children = entry.children.map(([_key, value]) => render(value, indent + 1)).join("");
        let result = "    ".repeat(indent) + `<${entry.element.tag}>\n`;
        result += children;
        result += "    ".repeat(indent) + `</${entry.element.tag}>\n`;

        return result;
    }

    return unreachable(entry);
};
