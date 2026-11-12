/**
 * Test stand-in for `index/web-worker/importer.worker`.
 *
 * In production, esbuild-plugin-inline-worker turns that module into a Worker constructor. Tests never start workers
 * (they inject `InProcessImporter`), and importing the real worker source would install a global `onmessage` handler.
 */
export default class ImporterWorkerStub {
    constructor() {
        throw new Error("Web workers are not available in tests; inject InProcessImporter instead.");
    }
}
