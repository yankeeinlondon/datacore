# Tables

## Paged (explicit page size)

```datacorejsx
return function View() {
    const books = dc.useQuery("@page and #pbook");
    const sorted = dc.useMemo(() => [...books].sort((a, b) => a.$name.localeCompare(b.$name)), [books]);
    return (
        <dc.Table
            rows={sorted}
            paging={5}
            columns={[
                { id: "Book", value: (page) => page.$link },
                { id: "Genre", value: (page) => page.value("genre") },
                { id: "Rating", value: (page) => page.value("rating") },
                { id: "Published", value: (page) => page.value("published") },
                { id: "Read time", value: (page) => page.value("readtime") },
                { id: "Author", value: (page) => page.value("author") },
                { id: "Aliases", value: (page) => page.value("aliases") },
            ]}
        />
    );
}
```

## Default paging (display settings)

```datacorejsx
return function View() {
    const books = dc.useQuery("@page and #pbook");
    const sorted = dc.useMemo(() => [...books].sort((a, b) => a.$name.localeCompare(b.$name)), [books]);
    return <dc.Table paging={true} rows={sorted} columns={[{ id: "Book", value: (page) => page.$link }]} />;
}
```

## Grouped

```datacorejsx
return function View() {
    const books = dc.useQuery("@page and #pbook and rating >= 4");
    const grouped = dc.useArray(books, (array) =>
        array.sort((page) => page.$name).groupBy((page) => page.value("genre")).sort((group) => group.key)
    );
    return (
        <dc.Table
            rows={grouped}
            groupings={(key, rows) => <b>{key} ({rows.length})</b>}
            columns={[
                { id: "Book", value: (page) => page.$link },
                { id: "Status", value: (page) => page.value("status") },
            ]}
        />
    );
}
```

## Custom column rendering

```datacorejsx
return function View() {
    const books = dc.useQuery("@page and #pbook and status = \"done\"");
    const sorted = dc.useMemo(() => [...books].sort((a, b) => a.$name.localeCompare(b.$name)).slice(0, 4), [books]);
    return (
        <dc.Table
            rows={sorted}
            paging={false}
            columns={[
                { id: "Book", title: "Title", value: (page) => page.$name, render: (value) => <i>{value}</i> },
                { id: "Pages", value: (page) => page.value("pages"), width: "minimum" },
            ]}
        />
    );
}
```
