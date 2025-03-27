import type { Reference } from "./reference";

export interface Resource {
  content: string;
  ref: Reference;
  type: string;
}
