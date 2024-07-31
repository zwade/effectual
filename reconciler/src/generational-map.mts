export class GenerationalMap<Key, Value> {
    private map: Map<Key, Value> = new Map();
    private generation: number = 0;
    private generationList: { generation: number; key: Key; previous?: Value }[] = [];

    public set(key: Key, value: Value) {
        this.generationList.push({ generation: this.generation, key, previous: this.map.get(key) });
        this.map.set(key, value);
    }

    public get(key: Key) {
        return this.map.get(key);
    }

    public pushGeneration() {
        this.generation += 1;
    }

    public popGeneration() {
        const gen = this.generation;
        this.generation -= 1;

        let i = this.generationList.length - 1;
        for (; i >= 0; i--) {
            const el = this.generationList[i];
            if (el.generation === gen) {
                if (el.previous) {
                    this.map.set(el.key, el.previous!);
                } else {
                    this.map.delete(el.key);
                }
            }
        }

        this.generationList.splice(i + 1);
    }
}
