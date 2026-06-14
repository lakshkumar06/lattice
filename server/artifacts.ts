export type Artifact = {
  abi: unknown[];
  bytecode: `0x${string}`;
};

export async function loadArtifact(name: string): Promise<Artifact> {
  const pathModule: any = await import("node:path");
  const urlModule: any = await import("node:url");
  const fsModule: any = await import("node:fs");
  const projectRoot = pathModule.join(
    pathModule.dirname(urlModule.fileURLToPath(import.meta.url)),
    "..",
  );
  const path = pathModule.join(projectRoot, "contracts", "out", `${name}.sol`, `${name}.json`);
  const json = (globalThis as any).JSON.parse(fsModule.readFileSync(path, "utf8"));
  const bytecode = typeof json.bytecode === "string" ? json.bytecode : json.bytecode?.object;

  if (!bytecode) {
    throw new Error(`No bytecode in artifact for ${name}; run forge build first.`);
  }

  return { abi: json.abi as unknown[], bytecode: bytecode as `0x${string}` };
}
