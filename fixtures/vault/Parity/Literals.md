# Literals

```datacorejsx
return function View() {
    const book = dc.useFile("Parity/Data/Parity Book 12.md");
    const values = [
        ["null", null],
        ["undefined", undefined],
        ["string", "plain string"],
        ["number", 42.5],
        ["boolean", true],
        ["date", dc.luxon.DateTime.fromISO("2024-03-05")],
        ["datetime", dc.luxon.DateTime.fromISO("2024-03-05T14:30:00")],
        ["duration", dc.luxon.Duration.fromObject({ hours: 3, minutes: 20 })],
        ["link", dc.fileLink("Parity/Data/Parity Book 01.md")],
        ["header link", dc.headerLink("Parity/Data/Parity Book 01.md", "Review")],
        ["block link", dc.blockLink("Parity/Data/Parity Book 01.md", "review-01")],
        ["array", [1, "two", false]],
        ["data array", dc.array([3, 1, 2])],
        ["nested array", [[1, 2], [3]]],
        ["object", { title: "Dune", year: 1965 }],
        ["field: published", book.value("published")],
        ["field: readtime", book.value("readtime")],
        ["field: author", book.value("author")],
        ["field: aliases", book.value("aliases")],
    ];
    return (
        <dc.Stack>
            {values.map(([label, value]) => (
                <div key={label}>
                    <b>{label}</b>: <dc.Literal value={value} />
                </div>
            ))}
            <div>
                <b>inline</b>: <dc.Literal value={["a", "b"]} inline={true} />
            </div>
            <dc.Markdown content={"Some **markdown** with a [[Parity Book 02]] link."} />
        </dc.Stack>
    );
}
```
