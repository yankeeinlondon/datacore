/** Minimal semver handling for API negotiation (no dependency). */

/** A parsed semantic version. */
export interface Version {
    major: number;
    minor: number;
    patch: number;
}

/** Parse `1`, `1.2`, `1.2.3` or `1.2.3-beta.1` (prerelease ignored). Returns undefined if unparseable. */
export function parseVersion(text: string): Version | undefined {
    const match = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?\s*$/.exec(text);
    if (!match) return undefined;
    return { major: Number(match[1]), minor: Number(match[2] ?? 0), patch: Number(match[3] ?? 0) };
}

function compareVersions(a: Version, b: Version): number {
    return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Whether an engine implementing `apiVersion` satisfies a consumer that needs `minApi`, using caret semantics:
 * `^1.2.0` accepts `>=1.2.0 <2.0.0`; for 0.x versions every minor is breaking (`^0.3.0` accepts `>=0.3.0 <0.4.0`).
 */
export function satisfiesApi(apiVersion: string, minApi: string): boolean {
    const api = parseVersion(apiVersion);
    const min = parseVersion(minApi);
    if (!api || !min) return false;
    if (compareVersions(api, min) < 0) return false;

    if (min.major > 0) return api.major === min.major;
    if (min.minor > 0) return api.major === 0 && api.minor === min.minor;
    return api.major === 0 && api.minor === 0 && api.patch === min.patch;
}
