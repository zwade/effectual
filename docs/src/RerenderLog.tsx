import { F, Store } from "@effectualjs/core";

const LogStore = Store.create<string[]>([]);

export const RerenderLog = () => {
    const log = LogStore.$provide();

    // This is a huge hack since we don't have effects yet
    if (!(window as any).hasHooked) {
        (window as any).hasHooked = true;
        __HOOK__("expansion_new", (root) => {
            if (root.element !== RerenderLog) {
                console.log(root.element.name);
                // We can't actually change state while inside of a hook, because we're mid render
                // at this point so we'll update the state but then get marked as clean
                // In the future i'd like for renderers to be able to make state changes, but that's low pri
                setTimeout(
                    () =>
                        log.set((log) => [
                            ...log,
                            `Rerendered ${new Date().toLocaleTimeString()}: ${root.element.name};`,
                        ]),
                    0,
                );
            }
        });
    }

    return (
        <div>
            <h3>Rerender Log</h3>
            <div
                style={{
                    height: "10rem",
                    border: "1px solid black",
                    borderRadius: "8px",
                    overflow: "scroll",
                    marginBottom: "1rem",
                }}
            >
                <div style={{ display: "flex", flexFlow: "column-reverse", padding: "0.5rem" }}>
                    {log.getValue().map((value, i) => (
                        <div key={i}>{value}</div>
                    ))}
                </div>
            </div>
        </div>
    );
};
