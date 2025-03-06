/**
 * A function that helps prove that a function can never reach a certain point
 *
 * ```ts
 * const doSomething = (value: string | number) => {
 *   if (typeof value === "string") return ...;
 *   if (typeof value === "number") return ...;
 *
 *   return unreachable(value);
 * }
 * ```
 */
export const unreachable = (value: never): never => {
    console.warn("Unreachable", value);
    throw new Error(`Unreachable: ${value}`);
};
