/**
 * An EffectualComponent is a function that returns any kind of valid EffectualElement.
 * It can be used to instantiate a new component via TSX.
 */
export interface EffectualComponent<Props extends Record<string, any> = any, Emits extends Record<string, any> = any> {
    (props?: Props, emits?: Emits): JSX.Element;
}

/**
 * NativeElements are those that are built-in to the browser, such as div, span, etc.
 * This type is produced by the createElement function (or more likely, the `F._jsx` helper).
 */
export type NativeElement = {
    kind: "native";
    tag: string;
    props?: Record<string, any>;
    children: EffectualElement[];
};

/**
 * An instantiation of a custom component. Notice that props and children are split apart.
 * Unlike react, `children` are not passed down to the component via a prop, but are instead
 * "slotted" into the component's template.
 */
export type EffectualSourceElement = {
    kind: "custom";
    element: EffectualComponent<any>;
    props?: Record<string, any>;
    emits?: Record<string, any>;
    children: EffectualElement[];
};

/**
 * A fragment is a special kind of element that is used to group multiple elements together.
 * It's functionally identical to an array of elements, but is instantiated differently.
 * (We ignore this distinction at the render stage).
 */
export type EffectualFragment = {
    kind: "fragment";
    children: EffectualElement[];
};

/**
 * A slot element is an instance of `<slot/>`. When a component returns a slot element,
 * the renderer will replace it with the children that were passed to the component.
 */
export type EffectualSlotElement = {
    kind: "slot";
    props?: Record<string, any>;
};

export type MultiElement = EffectualFragment | EffectualElement[];
export type SingletonElement =
    | NativeElement
    | EffectualSourceElement
    | EffectualSlotElement
    | string
    | boolean
    | number
    | null
    | undefined;
export type EffectualElement = MultiElement | SingletonElement;

type KeyProps<Props extends Record<string, any>> = {
    key?: string;
} & Props;

/**
 * `createElement` is the function used to instantiate a new component, whether it's a native
 * element or a customer component. Generally, you should invoke this via TSX syntax by adding the
 * following lines to your `tsconfig.json`:
 *
 * ```json
 * {
 *   "compilerOptions": {
 *       "jsx": "react",
 *       "jsxFactory": "F._jsx",
 *       "jsxFragmentFactory": "F._fragment",
 *    }
 * }
 * ```
 *
 * And then importing it at the callsite as `import { F } from "effectual"`.
 */
export function createElement(tag: "slot", props: null, ...children: EffectualElement[]): EffectualSlotElement;
export function createElement<Tag extends keyof HTMLElementTagNameMap, Props extends Record<string, any>>(
    tag: Tag,
    props: KeyProps<Props> | null,
    ...children: EffectualElement[]
): NativeElement;
export function createElement<Props extends Record<string, any>>(
    element: EffectualComponent<Props>,
    props: KeyProps<Props> | null,
    ...children: EffectualElement[]
): EffectualSourceElement;
export function createElement(
    element: typeof fragmentId,
    props: null,
    ...children: EffectualElement[]
): EffectualFragment;
export function createElement(
    tag: string | EffectualComponent<any> | typeof fragmentId,
    attrs: Record<string, any> | null,
    ...children: EffectualElement[]
): EffectualElement {
    if (tag === fragmentId) {
        return {
            kind: "fragment",
            children,
        };
    }

    if (tag === "slot") {
        return {
            kind: "slot",
        };
    }

    if (typeof tag === "function") {
        const props: Record<string, any> = {};
        const emits: Record<string, any> = {};

        let hasEmits = false;

        for (const key in attrs) {
            if (key.startsWith("$on:")) {
                emits[key.slice(4)] = attrs[key];
                hasEmits = true;
            } else {
                props[key] = attrs[key];
            }
        }

        return {
            kind: "custom",
            element: tag,
            props,
            emits: hasEmits ? emits : undefined,
            children,
        };
    }

    return {
        kind: "native",
        tag,
        props: attrs ?? undefined,
        children,
    };
}

export const fragmentId = Symbol.for("fragment");

declare global {
    namespace JSX {
        /**
         * The structure of all native components.
         * This is not currently implemented.
         */
        type CSSStyles = {
            [K in keyof CSSStyleDeclaration as CSSStyleDeclaration[K] extends string ? K : never]?: string;
        };

        type IntrinsicElements = {
            [K in keyof HTMLElementTagNameMap]: Record<string, any> & {
                "$on:click"?: (e: MouseEvent) => boolean | void;
                "$on:mousedown"?: (e: MouseEvent) => boolean | void;
                "$on:mouseup"?: (e: MouseEvent) => boolean | void;
                class?: string;
                style?: string | CSSStyles;
            };
        };

        /**
         * Those props that are available to every component.
         */
        type IntrinsicAttributes = {
            key?: string | number | boolean | null;
        };

        /**
         * What an "element" is in the context of JSX.
         */
        type Element = EffectualElement;

        type LibraryManagedAttributes<C, P> = P &
            (C extends (p: any, emits: infer Emits) => any
                ? { [Emit in keyof Emits as Emit extends string ? `$on:${Emit}` : never]: Emits[Emit] }
                : {});
    }
}
