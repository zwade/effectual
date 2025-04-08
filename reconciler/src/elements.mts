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
    element: F.EffectualComponent<any>;
    props?: Record<string, any>;
    emits?: Record<string, any>;
    children: Record<string, EffectualElement>;
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
    name?: string;
    props?: Record<string, any>;
};

/**
 * Portals allow teleporting elements to other sections of the dom
 */
export type EffectualPortalElement = {
    kind: "portal";
    element: unknown;
    children: EffectualElement[];
    props?: Record<string, any>;
};

export type MultiElement = EffectualFragment | EffectualElement[];
export type SingletonElement =
    | NativeElement
    | EffectualSourceElement
    | EffectualSlotElement
    | EffectualPortalElement
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
export function createElement(
    tag: "slot",
    props: { name?: string },
    ...children: EffectualElement[]
): EffectualSlotElement;
export function createElement(
    tag: "portal",
    props: { element: unknown },
    ...children: EffectualElement[]
): EffectualPortalElement;
export function createElement<Tag extends keyof HTMLElementTagNameMap, Props extends Record<string, any>>(
    tag: Tag,
    props: KeyProps<Props> | null,
    ...children: EffectualElement[]
): NativeElement;
export function createElement<Props extends Record<string, any>>(
    element: F.EffectualComponent<Props>,
    props: KeyProps<Props> | null,
    ...children: EffectualElement[]
): EffectualSourceElement;
export function createElement(
    element: typeof fragmentId,
    props: null,
    ...children: EffectualElement[]
): EffectualFragment;
export function createElement(
    tag: string | F.EffectualComponent<any> | typeof fragmentId,
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
            name: attrs?.name ?? undefined,
            props: attrs ?? undefined,
        };
    }

    if (tag === "portal") {
        return {
            kind: "portal",
            element: attrs?.element,
            props: undefined,
            children,
        };
    }

    if (typeof tag === "function") {
        const props: Record<string, any> = {};
        const emits: Record<string, any> = {};
        const allChildren: Record<string, EffectualElement> = {};

        let hasEmits = false;

        for (const key in attrs) {
            if (key.startsWith("$on:")) {
                emits[key.slice(4)] = attrs[key];
                hasEmits = true;
            } else if (key.startsWith("$slot:")) {
                allChildren[key.slice(6)] = attrs[key];
            } else {
                props[key] = attrs[key];
            }
        }

        if (children.length > 0) {
            allChildren["default"] = children;
        }

        return {
            kind: "custom",
            element: tag,
            props,
            emits: hasEmits ? emits : undefined,
            children: allChildren,
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

export declare namespace F {
    type Element = EffectualElement;

    type CSSStyles = {
        [K in keyof CSSStyleDeclaration as CSSStyleDeclaration[K] extends string ? K : never]?: string;
    };

    type Ctx<K extends { emits?: {}; slots?: {} }> = K;

    /**
     * An EffectualComponent is a function that returns any kind of valid EffectualElement.
     * It can be used to instantiate a new component via TSX.
     */
    interface EffectualComponent<
        Props extends Record<string, any> = any,
        Emits extends Record<string, any> = any,
        Slots extends Record<string, F.JSX.Element> = any,
    > {
        (props?: Props, ctx?: F.Ctx<{ emits: Emits; slots: Slots }>): F.JSX.Element;
    }

    namespace JSX {
        /**
         * The structure of all native components.
         * This is not currently implemented.
         */
        type ElementProps = Record<string, any> & {
            "$on:click"?: (e: MouseEvent) => boolean | void;
            "$on:mousedown"?: (e: MouseEvent) => boolean | void;
            "$on:mouseup"?: (e: MouseEvent) => boolean | void;
            class?: string;
            style?: string | F.CSSStyles;
        };

        type IntrinsicElements = {
            [K in keyof HTMLElementTagNameMap]: ElementProps;
        } & {
            portal: {
                element: unknown;
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
        type Element = F.Element;

        type LibraryManagedAttributes<C, P> = P &
            (C extends (p: any, ctx: infer Args extends { emits: {} }) => any
                ? {
                      [Emit in keyof Args["emits"] as Emit extends string ? `$on:${Emit}` : never]: Args["emits"][Emit];
                  }
                : {}) &
            (C extends (p: any, ctx: infer Args extends { slots: {} }) => any
                ? {
                      [Slot in keyof Args["slots"] as Slot extends string
                          ? `$slot:${Slot}`
                          : never]: Args["slots"][Slot];
                  }
                : {});
    }
}

export const F = {
    _jsx: createElement,
    _fragment: fragmentId,
};
