export type DataURL = `data:${string}` | Base64DataURL;
export type Base64DataURL = `data:${string};base64,${string}`;

// --

export async function dataUrlFromBlob(blob: Blob): Promise<Base64DataURL> {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${blob.type};base64,${base64}`;
}
