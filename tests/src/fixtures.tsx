import { F } from "@effectualjs/core";

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

export const D = (props: DProps) => {
    return <span>Test: {props.comment}</span>;
};

export const C = (props: CProps) => {
    return (
        <span className="test">
            <b>{props.comment}</b>
            <slot />
        </span>
    );
};

export const B = (props: BProps) => {
    return (
        <div className="foo">
            <slot />
            <C comment="test child rerender">
                <D comment="B version of D" />
            </C>
        </div>
    );
};

export const A = (props: AProps) => {
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

const noop = (strings: TemplateStringsArray, ...values: any[]) => {
    return (
        strings
            .slice(0, -1)
            .map((str, i) => str + (values[i] || ""))
            .join("") + strings[strings.length - 1]
    );
};

export const trim = (strings: TemplateStringsArray, ...values: any[]) => {
    return noop(strings, ...values).trim();
};
