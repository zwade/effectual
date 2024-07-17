export interface HydrationTarget<T extends HTNode<T> = OpaqueHTNode> {
    createElement: (tag: string) => HTContentNode<T>;
    createTextNode: (value: string) => HTTextNode<T>;
}

export interface HTBaseNode<T extends HTNode<T> = OpaqueHTNode> {
    readonly nextSibling: T | null;
}

export interface HTContentNode<T extends HTNode<T> = OpaqueHTNode> extends HTBaseNode<T> {
    insertBefore(content: T, rightNode: T | null): void;
    appendChild(content: T): void;
    removeChild(content: T): void;
    setAttribute(key: string, value: string): void;
    removeAttribute(key: string): void;
}

export interface HTTextNode<T extends HTNode<T> = OpaqueHTNode> extends HTBaseNode<T> {
    textContent: string | null;
}

export type HTNode<T extends HTNode<T> = OpaqueHTNode> = HTContentNode<T> | HTTextNode<T>;

export type OpaqueHydrationTarget = HydrationTarget<OpaqueHTNode>;
export type OpaqueHTBaseNode = HTBaseNode<OpaqueHTNode>;
export type OpaqueHTContentNode = HTContentNode<OpaqueHTNode>;
export type OpaqueHTTextNode = HTTextNode<OpaqueHTNode>;
export type OpaqueHTNode = HTNode<OpaqueHTTextNode | OpaqueHTContentNode>;

const _document_satisfies: Document extends OpaqueHydrationTarget ? true : false = true;
