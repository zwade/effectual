import { F } from "@effectualjs/core";
import { expand, MockHTContentNode, reconcile, RootHydrate } from "@effectualjs/reconciler";
import { MockHydrationTarget } from "@effectualjs/reconciler/dist/mock-target.mjs";
import { jest } from "@jest/globals";

import { D } from "./fixtures.js";

describe("Target Population Tests", () => {
    test("Test Single Target", () => {
        const root: RootHydrate = {
            kind: "root",
            node: new MockHTContentNode("div"),
        };

        const expanded = expand(<D comment="hi" />);
        reconcile(expanded, root, MockHydrationTarget);

        expect((root.node as MockHTContentNode).toString()).toBe("<div><span>Test: hi</span></div>");
    });

    test("Test Single Target with Update", () => {
        const root: RootHydrate = {
            kind: "root",
            node: new MockHTContentNode("div"),
        };

        const firstPass = expand(<D comment="hi" />);
        const firstReconcile = reconcile(firstPass, root, MockHydrationTarget);

        const secondPass = expand(<D comment="bye" />, firstPass);
        reconcile(secondPass, root, MockHydrationTarget, firstReconcile);

        expect((root.node as MockHTContentNode).toString()).toBe("<div><span>Test: bye</span></div>");
    });
});

describe("Target Update Tests", () => {
    const onCreate = jest.fn(() => {});
    const onUpdate = jest.fn(() => {});
    const onCreateText = jest.fn(() => {});
    const onUpdateText = jest.fn(() => {});

    beforeEach(() => {
        onCreate.mockClear();
        onUpdate.mockClear();
        onCreateText.mockClear();
        onUpdateText.mockClear();

        __HOOK__("create_hydrate", onCreate);
        __HOOK__("update_hydrate", onUpdate);
        __HOOK__("create_text_hydrate", onCreateText);
        __HOOK__("update_text_hydrate", onUpdateText);
    });

    afterEach(() => {
        __UNHOOK__("create_hydrate", onCreate);
        __UNHOOK__("update_hydrate", onUpdate);
        __UNHOOK__("create_text_hydrate", onCreateText);
        __UNHOOK__("update_text_hydrate", onUpdateText);
    });

    test("Test Hydrate Creation", () => {
        const root: RootHydrate = {
            kind: "root",
            node: new MockHTContentNode("div"),
        };

        const expanded = expand(<D comment="hi" />);
        reconcile(expanded, root, MockHydrationTarget);

        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(onCreateText).toHaveBeenCalledTimes(2);
    });
});
