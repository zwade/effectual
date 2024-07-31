import { BaseStore } from "./reactivity.mjs";

export class Store<Data> extends BaseStore<Data> {
    public use(): Data {
        const container = this.useContainer();
        if (container) {
            return container.getValue();
        }

        return this.default;
    }

    public static create<T>(): Store<T | undefined>;
    public static create<T>(default_: T): Store<T>;
    public static create<T>(default_?: T): Store<T | undefined> {
        return new Store<T | undefined>(default_);
    }
}

export class AssignableStore<Data> extends BaseStore<Data> {
    public use(): [Data, (value: Data) => void] {
        const container = this.useContainer();
        if (container) {
            return [container.getValue(), container.setValue.bind(container)];
        }

        return [
            this.default,
            () => {
                throw new Error("Cannot set value on unmounted store");
            },
        ];
    }

    public static create<T>(): AssignableStore<T | undefined>;
    public static create<T>(default_: T): AssignableStore<T>;
    public static create<T>(default_?: T): AssignableStore<T | undefined> {
        return new AssignableStore<T | undefined>(default_);
    }
}
