import "./index.css";
declare global {
    interface HTMLCollection {
        [Symbol.iterator]: () => Iterator<HTMLElement>;
    }
}
