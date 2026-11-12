# Links and Embeds

```dcx
return function View() {
    const book = dc.useFile("Parity/Data/Parity Book 03.md");
    const review = dc.useQuery("@section and $name = \"Review\" and childof(@page and $name = \"Parity Book 03\")")[0];
    return (
        <dc.Stack>
            <dc.Link link={dc.fileLink("Parity/Data/Parity Book 03.md")} />
            <dc.Link link="Parity/Data/Parity Book 04.md" />
            <dc.Link link={dc.headerLink("Parity/Data/Parity Book 03.md", "Tasks")} />
            <dc.LinkEmbed link={dc.blockLink("Parity/Data/Parity Book 03.md", "review-03")} />
            <dc.SpanEmbed path="Parity/Data/Parity Book 05.md" start={14} end={18} />
            {review ? dc.embed(review) : <span>no review section</span>}
            <span>{book.$link.toString()}</span>
        </dc.Stack>
    );
}
```
