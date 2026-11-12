# Require

## Module

```dc
function shout(text) {
    return text.toUpperCase() + "!";
}
return { shout };
```

## Uses

```dcx
return function View() {
    const [state, setState] = dc.useState(undefined);
    dc.useEffect(() => {
        (async () => {
            const file = await dc.require("Parity/scripts/greeting.js");
            const section = await dc.require(dc.headerLink("Parity/Require.md", "Module"));
            const obsidian = await dc.require("obsidian");
            setState({
                greet: file.greet("parity"),
                where: file.where,
                shout: section.shout("from a section"),
                obsidian: typeof obsidian.Notice,
            });
        })().catch((error) => setState({ error: String(error) }));
    }, []);
    if (!state) return <p>loading</p>;
    return <pre>{JSON.stringify(state, null, 2)}</pre>;
}
```
