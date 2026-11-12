/**
 * Project-specific lint rules, loaded by oxlint as a JS plugin (`jsPlugins` in .oxlintrc.json).
 *
 * - `datacore/no-class`: forbids class declarations/expressions. Applied to `packages/shared`, whose code is bundled
 *   separately into every plugin; classes there would exist once per bundle and break `instanceof`/identity checks
 *   across plugins (Engine Room spec, D9).
 */

const noClass = {
    meta: {
        type: "problem",
        docs: {
            description: "Disallow classes in code that is bundled into multiple plugins.",
        },
        messages: {
            noClass:
                "Classes are not allowed here: this code is bundled into each plugin separately, so every bundle would " +
                "get its own class and identity checks would fail across plugins. Use plain objects and functions.",
        },
        schema: [],
    },
    create(context) {
        const report = (node) => context.report({ node, messageId: "noClass" });
        return { ClassDeclaration: report, ClassExpression: report };
    },
};

export default {
    meta: { name: "datacore" },
    rules: { "no-class": noClass },
};
