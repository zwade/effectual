import { EffectualSourceElement, expand, F, render } from "@effectualjs/core";
import { jest } from "@jest/globals";

import { A, C, D } from "./fixtures.js";

describe("Rendering Tests", () => {
    test("Test Single Element Render", () => {
        const expanded = expand(<D comment="hi" />);
        const rendered = render(expanded);

        expect(rendered).toBe(`<span>Test: hi</span>`);
    });

    test("Test Deeply Nested Render", () => {
        const expanded = expand(<A first />);
        const rendered = render(expanded);

        expect(rendered).toBe(
            `<div className="foo"><span className="test"><b>Number 1</b><span>Test: A version of D #1</span>First Child!</span><span className="test"><b>test child rerender</b><span>Test: B version of D</span></span></div>`,
        );
    });
});

describe("Expansion Test", () => {
    const expansionCb = jest.fn((root: EffectualSourceElement, previousRoot: any) => {
        // pass;
    });

    beforeEach(() => {
        expansionCb.mockClear();
        __HOOK__("expansion_new", expansionCb);
    });

    afterEach(() => {
        __UNHOOK__("expansion_new", expansionCb);
    });

    test("Single Element Single Execution", () => {
        expand(<D comment="hi" />);
        expect(expansionCb).toHaveBeenCalledTimes(1);
    });

    test("Multiple Element Multiple Execution", () => {
        expand(
            <C comment="test">
                <D comment="test" />
            </C>,
        );
        expect(expansionCb).toHaveBeenCalledTimes(2);
    });

    test("Deeply Nested Multi Execution", () => {
        expand(<A first />);
        expect(expansionCb).toHaveBeenCalledTimes(6);
    });

    test("Deeply Nested Differential Execution", () => {
        const firstPass = expand(<A first />);
        expect(expansionCb).toHaveBeenCalledTimes(6);
        expansionCb.mockClear();

        expand(<A />, firstPass);
        expect(expansionCb).toHaveBeenCalledTimes(3);
    });
});
