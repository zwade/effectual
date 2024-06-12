const OFF = "off";
const WARN = "warn";
const ERROR = "error";

module.exports = {
    root: true,
    settings: {
        react: {
            version: "detect",
        },
    },
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    ignorePatterns: ["queries.ts", "postgres.ts"],
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 12,
        sourceType: "module",
    },
    plugins: ["react", "@typescript-eslint", "simple-import-sort"],
    rules: {
        "linebreak-style": [ERROR, "unix"],
        "react/display-name": OFF,
        "@typescript-eslint/explicit-module-boundary-types": OFF,
        "eol-last": WARN,
        "simple-import-sort/imports": [
            ERROR,
            {
                groups: [
                    ["^\\u0000.*(?<!\\.s?css)$"], // Side effect imports (but not css)
                    ["^(@)?\\w"], // node builtins and external packages
                    ["^(?!(\\.|@\\/))"], // anything that's not a relative import
                    ["^@\\/"], // absolute imports
                    ["^\\."], // relative imports
                    ["\\.s?css$"], // style imports
                ],
            },
        ],
        "simple-import-sort/exports": ERROR,
        "object-curly-spacing": [ERROR, "always"],
        "@typescript-eslint/member-delimiter-style": ERROR,
        "@typescript-eslint/no-unused-vars": [
            WARN,
            {
                varsIgnorePattern: "(^_)|(F)",
                argsIgnorePattern: "(^_)|(props)",
                args: "after-used",
            },
        ],
        "react/jsx-uses-vars": ERROR,
        "react/jsx-uses-react": ERROR,
        "react/react-in-jsx-scope": OFF,
        "@typescript-eslint/no-non-null-assertion": OFF,
        "@typescript-eslint/no-namespace": OFF,
        "@typescript-eslint/no-explicit-any": OFF,
        "prefer-const": [
            ERROR,
            {
                destructuring: "all",
            },
        ],
        "@typescript-eslint/no-empty-interface": OFF,
        "@typescript-eslint/no-empty-function": OFF,
        "@typescript-eslint/naming-convention": OFF,
        "no-inner-declarations": OFF,
        "@typescript-eslint/no-non-null-asserted-optional-chain": OFF,
        "no-constant-condition": OFF,
        "no-async-promise-executor": OFF,
        "@typescript-eslint/ban-types": OFF,
    },
    overrides: [
        {
            files: [".*.js", "*.json"],
            rules: {
                "@typescript-eslint/naming-convention": OFF,
            },
        },
    ],
};
