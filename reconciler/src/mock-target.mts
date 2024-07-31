import { HTBaseNode, HTContentNode, HTTextNode, HydrationTarget } from "./hydration-target.mjs";

export const MockHydrationTarget: HydrationTarget<MockHTNode> = {
    createElement: (tag: string) => {
        return new MockHTContentNode(tag);
    },

    createTextNode: (value: string) => {
        return new MockHTTextNode(value);
    },
};

export class MockHTBaseNode implements HTBaseNode<MockHTNode> {
    parent: MockHTContentNode | undefined;

    public setParent(parent: MockHTContentNode | undefined) {
        this.parent = parent;
    }

    get nextSibling(): MockHTNode | null {
        if (this.parent === undefined) {
            return null;
        }

        return this.parent.getChildSibling(this as unknown as MockHTNode);
    }
}

export class MockHTContentNode extends MockHTBaseNode implements HTContentNode<MockHTNode> {
    readonly tag;

    children: MockHTNode[];
    attributes: [key: string, value: string][];

    constructor(tag: string) {
        super();
        this.tag = tag;
        this.children = [];
        this.attributes = [];
    }

    public insertBefore(content: MockHTNode, rightNode: MockHTNode | null): void {
        if (rightNode === null) {
            this.appendChild(content);
            return;
        }

        const index = this.children.indexOf(rightNode);
        if (index < 0 || content === null) {
            return;
        }

        this.children.splice(index, 0, content);
        content.setParent(this);
    }

    public appendChild(content: MockHTNode): void {
        this.children.push(content);
    }

    public removeChild(content: MockHTNode): void {
        const index = this.children.indexOf(content);

        if (index >= 0) {
            this.children.splice(index, 1);
        }

        content.setParent(undefined);
    }

    public getChildSibling(child: MockHTNode): MockHTNode | null {
        const index = this.children.indexOf(child);

        if (index < 0) {
            return null;
        }

        return this.children[index + 1] ?? null;
    }

    public setAttribute(key: string, value: string): void {
        const index = this.attributes.findIndex(([existingKey]) => key === existingKey);

        if (index < 0) {
            this.attributes.push([key, value]);
        } else {
            this.attributes.splice(index, 1, [key, value]);
        }
    }

    public removeAttribute(key: string): void {
        const index = this.attributes.findIndex(([existingKey]) => existingKey === key);

        if (index >= 0) {
            this.attributes.splice(index, 1);
        }
    }

    public addEventListener(_eventName: string, _callback: () => void): void {
        // pass
    }

    public removeEventListener(_eventName: string, _callback: () => void): void {
        // pass
    }

    public get style() {
        return { cssText: "", setProperty() {} };
    }

    public toString(): string {
        const children = this.children.map((child) => child.toString()).join("");
        const props = this.attributes
            .filter(([_key, value]) => value !== undefined)
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ");

        let result = `<${this.tag}${props ? ` ${props}` : ""}>`;
        result += children;
        result += `</${this.tag}>`;

        return result;
    }
}

export class MockHTTextNode extends MockHTBaseNode implements HTTextNode<MockHTNode> {
    public textContent: string;

    constructor(data: string) {
        super();
        this.textContent = data;
    }

    public setParent(parent: MockHTContentNode | undefined) {
        this.parent = parent;
    }

    get nextSibling(): MockHTNode | null {
        if (this.parent === undefined) {
            return null;
        }

        return this.parent.getChildSibling(this);
    }

    public toString() {
        return this.textContent;
    }
}

export type MockHTNode = MockHTContentNode | MockHTTextNode;
