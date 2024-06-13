import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default [
    {
        input: "src/index.tsx",
        output: {
            file: "dist/bundle.mjs",
            format: "esm",
        },
        plugins: [nodeResolve(), typescript()],
    },
];
