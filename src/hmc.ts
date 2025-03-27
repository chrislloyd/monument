/**
 * @module hyper model context (HMC)
 */

export type Text = { type: "text"; text: string };

export type Image = { type: "image"; url: string; description?: string };

export type Link = { type: "link"; url: string; description?: string };

export type Transclusion = {
  type: "transclusion";
  url: string;
  description?: string;
};

type StringParameter = { type: "string" };
type NumberParameter = { type: "number" };
type ObjectParameter = {
  type: "object";
  properties: { [key: string]: ActionParameter };
};
type ArrayParameter = { type: "array"; items: ActionParameter };
export type ActionParameter =
  | StringParameter
  | NumberParameter
  | ObjectParameter
  | ArrayParameter;

export type Action = {
  type: "action";
  name: string;
  description?: string;
  parameter?: ObjectParameter;
};

export type Fragment = Text | Image | Link | Transclusion | Action;

export type HyperModelContext = Fragment[];

// --

export function text(text: string): Text {
  return { type: "text", text };
}

export function image(
  url: Image["url"],
  description?: Image["description"],
): Image {
  return { type: "image", url, description };
}

export function link(
  url: Link["url"],
  description?: Link["description"],
): Link {
  return { type: "link", url, description };
}

export function transclusion(
  url: Transclusion["url"],
  description: Transclusion["description"],
): Transclusion {
  return { type: "transclusion", url, description };
}

export function action(
  name: Action["name"],
  description?: Action["description"],
  parameter?: Action["parameter"],
): Action {
  return { type: "action", name, description, parameter };
}

// ---

export function postprocessdocument(
  input: HyperModelContext,
): HyperModelContext {
  let output: HyperModelContext = [];

  // 1. Merge all text fragments into a single fragment

  for (let i = 0; i < input.length; i += 1) {
    const fragment = input[i]!;

    if (fragment.type === "text") {
      let buffer = fragment.text;

      // Merge all subsequent text fragments
      for (let j = i + 1; j < input.length; j += 1) {
        const next = input[j]!;

        if (next.type === "text") {
          buffer += "\n";
          buffer += next.text;
          i = j;
        } else {
          break;
        }
      }

      output.push(text(buffer));
    } else {
      output.push(fragment);
    }
  }

  // 2. Trim all text fragments

  for (const fragment of output) {
    if (fragment.type === "text") {
      fragment.text = fragment.text.trim();
    }
  }

  // 3. Remove any empty text fragments

  output = output.filter((fragment) => {
    return fragment.type !== "text" || fragment.text !== "";
  });

  return output;
}

export async function resolveTransclusionsHmc(
  hmc: HyperModelContext,
  need: (url: string) => Promise<unknown>,
): Promise<Fragment[][]> {
  return await Promise.all(
    hmc.map(async (fragment): Promise<Fragment[]> => {
      switch (fragment.type) {
        case "transclusion": {
          const child = await need("examples/" + fragment.url);
          return [text(child as string)];
        }
        default:
          return [fragment];
      }
    }),
  );
}
