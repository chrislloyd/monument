import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';

export default function Markdown({ children }: { children: string }) {
  const components: Components = {
    a: Link,
    p: ({ children }) => <p className="m-0">{children}</p>,
    h1: ({ children }) => <h1 className="m-0">{children}</h1>,
    h2: ({ children }) => <h2 className="m-0">{children}</h2>,
    h3: ({ children }) => <h3 className="m-0">{children}</h3>,
  };
  return <ReactMarkdown className="font-sans leading-relaxed grid gap-2" components={components}>
    {children}
  </ReactMarkdown>;
}
