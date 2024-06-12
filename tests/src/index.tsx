import { expand, F, render } from "@effectualjs/core";

interface DProps {
    comment?: string;
}

interface CProps {
    comment: JSX.Element;
}

interface BProps {
    // pass;
}

interface AProps {
    first?: boolean;
}

const D = (props: DProps) => {
    console.log("Rerendering D", props.comment);

    return <span>Test: {props.comment}</span>;
};

const C = (props: CProps) => {
    console.log("Rerendering C", props);

    return (
        <span className="test">
            <b>{props.comment}</b>
            <slot />
        </span>
    );
};

const B = (props: BProps) => {
    console.log("Rerendering B", props);

    return (
        <div className="foo">
            <slot />
            <C comment="test child rerender">
                <D comment="B version of D" />
            </C>
        </div>
    );
};

const A = (props: AProps) => {
    console.log("Rerendering A", props);

    if (props.first) {
        return (
            <B>
                <C comment="Number 1">
                    <D comment="A version of D #1" />
                    First Child!
                </C>
            </B>
        );
    }

    return (
        <B>
            <C comment="Number 2">
                <D comment="A version of D #2" />
                Second Child!
            </C>
        </B>
    );
};

const firstElement = <A first />;
const secondElement = <A />;

const originalPass = expand(firstElement);

__HOOK__("expansion_new", (root: JSX.Element, previousRoot: any) => {
    console.log(root, previousRoot);
});

console.log(render(originalPass));

console.log("-------------");

const secondPass = expand(secondElement, originalPass);

console.log(render(secondPass));
