import { promises as fs } from 'fs';
import Markdown from "@/Markdown";

export default async function Page() {
  const readme = await fs.readFile(process.cwd() + '/README.md', 'utf8');
  return <div className="md:w-1/2 p-4">
    <Markdown>{readme}</Markdown>
  </div>;
}
