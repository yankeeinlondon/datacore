# Lists

## Unordered, ordered, block

```dcx
return function View() {
    const authors = dc.useQuery("@page and #pauthor");
    const sorted = dc.useMemo(() => [...authors].sort((a, b) => a.$name.localeCompare(b.$name)), [authors]);
    return (
        <dc.Stack>
            <dc.List rows={sorted} renderer={(page) => page.$link} />
            <dc.List type="ordered" rows={sorted} renderer={(page) => page.value("country")} />
            <dc.List type="block" rows={sorted} renderer={(page) => page.$name} />
        </dc.Stack>
    );
}
```

## Grouped and paged

```dcx
return function View() {
    const books = dc.useQuery("@page and #pbook");
    const grouped = dc.useArray(books, (array) =>
        array.sort((page) => page.$name).groupBy((page) => page.value("status")).sort((group) => group.key)
    );
    return <dc.List rows={grouped} paging={6} renderer={(page) => page.$link} />;
}
```

## Tasks with children

```dcx
return function View() {
    const tasks = dc.useQuery("@task and childof(@page and #pbook and rating = 5)");
    const sorted = dc.useMemo(
        () => [...tasks].sort((a, b) => a.$file.localeCompare(b.$file) || a.$line - b.$line),
        [tasks]
    );
    return <dc.List rows={sorted} maxChildDepth={2} />;
}
```
