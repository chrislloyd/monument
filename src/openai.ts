import remember from "./remember";


export default async function openai(path: string, params: any, signal: AbortSignal): Promise<any> {
  const apiKey = remember('What is your OpenAI key?');
  const response = await fetch(`https://api.openai.com/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(params),
    signal,
  });
  const data = await response.json();
  return data;
}
