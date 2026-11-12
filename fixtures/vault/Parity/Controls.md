# Controls

```datacorejsx
return function View() {
    const [count, setCount] = dc.useState(0);
    return (
        <dc.Stack>
            <dc.Button intent="success" onClick={() => setCount(count + 1)}>
                Clicked {count} times
            </dc.Button>
            <dc.Textbox value="text value" placeholder="placeholder" />
            <dc.Checkbox checked={true}>Checked</dc.Checkbox>
            <dc.Checkbox defaultChecked={false}>Unchecked</dc.Checkbox>
            <dc.Slider min={0} max={10} step={1} value={4} />
            <dc.Switch checked={true} />
            <dc.VanillaSelect
                value="b"
                options={[
                    { value: "a", label: "Alpha" },
                    { value: "b", label: "Beta" },
                ]}
            />
        </dc.Stack>
    );
}
```
