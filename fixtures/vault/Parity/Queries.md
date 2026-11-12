# Queries and expressions

```datacorejsx
return function View() {
    const rows = [
        ["query count", dc.query("@page and #pbook and rating > 3").length],
        ["tryQuery failure", String(dc.tryQuery("@page and (").successful)],
        ["fullquery count", dc.fullquery("@task and childof(@page and #pbook)").results.length],
        ["evaluate", dc.evaluate("x + y * 2", { x: 1, y: 3 })],
        ["evaluate link field", dc.evaluate("[[Parity Book 09]].rating")],
        ["tryEvaluate failure", String(dc.tryEvaluate("nosuchfunction(1)").successful)],
        ["resolvePath", dc.resolvePath("Parity Book 10")],
        ["parseLink", dc.parseLink("[[Parity Book 10#Review|the review]]").toString()],
        ["tryParseLink failure", String(dc.tryParseLink("[not a link").successful)],
        ["coerce.number", dc.coerce.number("49.2")],
        ["coerce.boolean", String(dc.coerce.boolean("true"))],
        ["coerce.date", dc.coerce.date("2025-05-10")?.toISODate()],
        ["coerce.duration", dc.coerce.duration("14 hours")?.as("minutes")],
        ["coerce.link", dc.coerce.link("[[Parity Book 11]]")?.path],
        ["coerce.array", JSON.stringify(dc.coerce.array(1))],
        ["array ops", dc.array([5, 3, 9]).sort().map((n) => n * 2).join("|")],
        ["Array.isArray(dc.array)", String(Array.isArray(dc.array([1])))],
        ["resolveLink", dc.resolveLink("Parity Book 13")?.$name],
        ["sections", dc.query("@section and childof(@page and $name = \"Parity Book 13\")").map((s) => s.$name).sort().join(", ")],
    ];
    return (
        <table>
            <tbody>
                {rows.map(([label, value]) => (
                    <tr key={label}>
                        <td>{label}</td>
                        <td>{String(value)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
```
