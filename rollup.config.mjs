import nodeResolve from "@rollup/plugin-node-resolve";

export default [
    {
        input: 'core/src/index.mts',
        output: {
            file: 'lib/bundle.mjs',
            format: 'esm'
        },
        plugins: [
            nodeResolve()
        ]
    }
];