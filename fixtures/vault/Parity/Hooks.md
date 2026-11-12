# Hooks

```datacorejsx
return function View() {
    const books = dc.useQuery("@page and #pbook");
    const full = dc.useFullQuery("@page and #pauthor");
    const file = dc.useFile("Parity/Data/Parity Author 2.md");
    const current = dc.useCurrentFile();
    const currentPath = dc.useCurrentPath();
    const revision = dc.useIndexUpdates();
    const byStatus = dc.useArray(books, (array) =>
        array.groupBy((page) => page.value("status")).sort((group) => group.key).map((group) => `${group.key}: ${group.rows.length}`)
    );
    const interned = dc.useInterning({ a: 1 }, (a, b) => a.a === b.a);
    const reduced = dc.useReducer((state, action) => state + action, 10)[0];
    const ref = dc.useRef("ref value");
    return (
        <ul>
            <li>useQuery: {books.length}</li>
            <li>useFullQuery: {full.results.length} results, revision is a number: {String(typeof full.revision === "number")}</li>
            <li>useFile: {file?.$name}</li>
            <li>useCurrentFile: {current?.$name}</li>
            <li>useCurrentPath: {currentPath}</li>
            <li>useIndexUpdates is a number: {String(typeof revision === "number")}</li>
            <li>useArray: {byStatus.join(", ")}</li>
            <li>useInterning: {interned.a}</li>
            <li>useReducer: {reduced}</li>
            <li>useRef: {ref.current}</li>
        </ul>
    );
}
```
