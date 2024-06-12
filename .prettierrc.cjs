module.exports = {
    parser: "typescript",
    printWidth: 120,
    tabWidth: 4,
    trailingComma: "all",
    overrides: [
        {
            files: "*.json",
            options: {
                parser: "json",
            },
        },
    ],
};
