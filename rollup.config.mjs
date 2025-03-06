import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default [
    {
        input: "core/src/index.mts",
        output: {
            file: "lib/bundle.mjs",
            format: "esm",
        },
        plugins: [nodeResolve(), typescript({ outDir: "lib", include: ["./core/**/*.mts"] })],
    },
];
