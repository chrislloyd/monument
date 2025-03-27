// Typically, model context params include things that encode behavior into the
// model such as fetching urls etc. The goal of this module is to deliniate
// between a context description that includes runtime behavior and one that
// is fully resolved. A `ModelDocument` is a fully resolved document - it should be a complete encoding of everything the model needs. A "Hyper" document is a similar description but with higher level abstractions that need to be resolved.

// Basic

export type BlobFragment = {
  type: "blob";
  blob: Blob;
};

export type ActionFragment = {
  type: "action";
  name: string;
  description?: string;
};

export type Fragment = BlobFragment | ActionFragment;

export type ModelDocument = {
  body: Fragment[];
};

// Hyper

export type TextFragment = {
  type: "text";
  text: string;
};

export type ImageFragment = {
  type: "image";
  url: string;
  description?: string;
};

export type AudioFragment = {
  type: "audio";
  url: string;
  description?: string;
};

export type TransclusionFragment = {
  type: "transclusion";
  url: string;
  description?: string;
};

export type HyperFragment =
  | TextFragment
  | ImageFragment
  | AudioFragment
  | TransclusionFragment;

export type HyperModelDocument = {
  url: string;
  body: HyperFragment[];
};
