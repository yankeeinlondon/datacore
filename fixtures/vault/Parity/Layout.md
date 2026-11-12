# Layout

```datacorejsx
return function View() {
    const book = dc.useFile("Parity/Data/Parity Book 07.md");
    return (
        <dc.Stack>
            <dc.Group justify="space-between">
                <span>left</span>
                <span>right</span>
            </dc.Group>
            <dc.Card
                title={book.$name}
                content={(value) => <span>{value?.value("genre") ?? "-"}</span>}
                footer="card footer"
                value={book}
            />
            <dc.Callout title="Open callout" type="info" open={true}>
                Callout body for {book.$name}.
            </dc.Callout>
            <dc.Callout title="Closed callout" type="warning" collapsible={true} open={false}>
                Hidden body.
            </dc.Callout>
            <dc.Icon icon="book" />
        </dc.Stack>
    );
}
```
