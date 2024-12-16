export default function Portal({ alt, src }: { alt: string, src: string }) {
  return <div className="inline-block px-2 bg-blue-100 text-blue-800 rounded-full">
    {alt || src}
  </div>
}