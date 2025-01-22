/**
 * @see https://prettier.io/docs/en/options.html
 */
module.exports = {
    // Specify a modern column width
    printWidth: 110,
    // Trailing commas in objects, arrays but not function args
    trailingComma: 'es5',

    // use 4 spaces to indent
    tabWidth: 4,
    useTabs: false,

    // use semis... please
    semi: true,

    singleQuote: true,

    // If one object property needs quotes, they all do
    quoteProps: 'consistent',

    // Force parens on arrow funcs
    arrowParens: 'always',
};
