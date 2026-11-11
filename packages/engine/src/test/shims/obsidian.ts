/**
 * Minimal runtime stand-in for the `obsidian` module in unit tests.
 *
 * The `obsidian` npm package ships type declarations only, so any engine module that imports a runtime value from it
 * (e.g. `TFile`/`TFolder` for `instanceof` checks in the folder index) cannot load under Vitest without this shim.
 * Add classes here only as tests start needing them; keep them behaviour-free.
 */

export class TAbstractFile {
    path = "";
    name = "";
}

export class TFile extends TAbstractFile {
    basename = "";
    extension = "";
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[] = [];
}
