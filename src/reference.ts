export interface Reference {
  path: string;
  protocol: string;
}

// --

export class Identity implements Reference {
  constructor(
    readonly protocol: string,
    readonly path: string,
  ) {}
}

// --

export function urlFromReference(ref: Reference): URL {
  return new URL(`${ref.protocol}:${ref.path}`);
}

export function referenceFromURL(url: URL): Reference {
  return new Identity(url.protocol, url.pathname);
}
