export async function file(url: URL): Promise<string> {
  return await Bun.file(url).text();
}
