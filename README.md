# Monument

* TODO Demo
* [Try it for yourself](#usage)
* [Latest updates](https://github.com/chrislloyd/monument/commits)
* [Source code](https://github.com/chrislloyd/monument)

---

## TODO

* [ ] infinite loops (disallow recursive transcludes after x recursions?)
* [ ] lazily depend on files that haven't been created yet (i.e. files in output dirs)
* [ ] support http resources
  * [ ] utc time from chislloyd.net/utc.md
* [x] output chatgpt message format
  * [ ] include image context
  * [x] split at transclusions to give the model an extra hint as to sections
* [ ] markdown
  * [ ] actions from links
  * [ ] ignore comments
* [ ] cli
  * [ ] narrow down file format/directory names. `.monument` for ai? Is intermediate `.txt` needed? customizable?
  * [ ] interactive repl. creates a new md document
* [ ] actions
* [ ] hypertext
  * [ ] support iframe transclusion for html
  * [ ] actions from links/forms/buttons (ala. htmx)
  * [ ] how to run local http server to expose system state? (filesystem, contacts etc.) how can this be extensible? MCP?
* [ ] UI
  * [ ] vscode plugin?
  * [ ] obsidian plugin?
* [ ] readme
  * [ ] define transclusion
  * [ ] more examples for programming environment vs IDE
  * [ ] more comparisons (Observable, Jupyter)
  * [ ] make relationship between documents and programs clearer
  * [ ] examples of what you can actually build
    * [ ] time zone converter
    * [ ] evals
    * [ ] writing prompts
  * [ ] explanation of `.txt` and `.ai.txt` extensions
  * [ ] include most of my obsidian notes
  * [ ] screenshots/videos
  * [ ] architecture
    * [ ] diagram
    * [ ] how does the reactive processing work?
    * [ ] what's the relationship between markdown files and execution
    * [ ] how do the various commands work together

---

**Monument** reimagines the programming environment. Modern operating systems restrict user agency by hiding data in binary files and concealing state in processes. AI enables us to rethink how we store and interact with data.

What makes a "programming environment"? It goes beyond tools like [VSCode](https://code.visualstudio.com). It draws inspiration from [LISP machines](https://en.wikipedia.org/wiki/Lisp_machine), the [Canon Cat](https://en.wikipedia.org/wiki/Canon_Cat), [Hypercard](https://hypercard.org), and [Dynamicland](https://dynamicland.org/2024/FAQ/#What_do_you_mean_by_dynamic_medium). A programming environment unifies program editing and execution, creating a live, malleable system.

**Monument** takes the first step toward this vision by reactively processing documents through an LLM. Documents connect through transclusion to form large, dynamic knowledge graphs. You can reuse and abstract programs through transclusion. Like a spreadsheet, the reactive document system maintains efficiency and stays current.

I welcome you to learn from both the successes and challenges of this project. Please be kind ✌️

## Features

TODO

### Limitations

(In random order)

1. Non-deterministic output. Even fully deterministic models are very sensitive[CITE] to small changes in prompts, so the output _feels_ non-deterministic. **Monument** instead strives for _semantic stability_. For example, these two outputs are roughly the same despite subtle differences in input:

```
The weather today is 19c.
```

```
19c
```

2. Results need verification. Models excel in many areas but can make mistakes. I plan to add the ability to do evals, but this represents a fundamental shift in computing. It's much more like talking to a person than a calculator.

3. High-level. **Monument** may help you meal-plan but it probably won't let you write kernel device drivers. I'm building this for muggles, not wizzards. Computer-industry professionals already have excellent tools and entrenched practices whereas regular people are chronically underserved.

4. Efficiency. A key principle to **Monument** is _live-ness_. As you make changes, results should be reflected immediately. That means lots of calls to models. There exists opportunites to optimize this, but for as long as this remains a research prototype it'll cost quite a bit of energy/money.

5. Privacy. I'm using remote models, specifically OpenAI.  because they are really high-quality, fast and it's relatively easy. This means all your data is transmitted to OpenAI. This isn't ideal, but the engineering work making local models work reliably feels significant but mechanistic. There isn't much to learn by changing this but is a requirement that will obviously change as this gets closer to shipping.

## Usage

### Basic Example

```shell
bun run bin/monument.ts --directory examples --output-directory examples/out
```

### More Examples

TODO

### Markdown Syntax

Monument extends the semantic meaning of Markdown by remapping the image syntax to mean "transclusion":

1. **Inline transclusions** using `![description](source)`:

   ```markdown
   The current time is ![utc time](https://chrislloyd.net/utc.md)
   ```

2. **Block transclusions** using `![description](source)` on a single line:

   ```markdown
   ![recipes](./recipes.md)
   ```

## Philosophy

TODO

* Propagator networks / signals
* call convension
* handwritten prompts (unlike https://spiral.computer, vscode /test)

Tools like [Cursor](https://cursor.com) and [Copilot](https://github.com/features/copilot) enhance text editors but don't address their fundamental limitation: they lack liveness (as explained in [this talk](https://www.youtube.com/watch?v=ZfytHvgHybA)). These tools facilitate a model-to-code-to-execution workflow. **Monument** asks: why not communicate directly with the program?

## Development

This project embraces experimentation. Given its exploratory nature, I prioritize rapid iteration over traditional software engineering practices. This means minimal CI, limited testing, and JavaScript implementation. A more suitable language may power future versions once the project's direction solidifies.

### Prerequisites

* [Jujutsu](https://jj-vcs.github.io/jj/latest/)
* [Bun](https://bun.sh) >= [1.2.2](https://github.com/oven-sh/bun/releases/tag/bun-v1.2.2)

### Setup

1. Clone the repository

   ```sh
   jj git clone https://github.com/chrislloyd/monument
   ```

2. Install dependencies:

   ```sh
   bun install
   ```

3. Run tests:

   ```sh
   bun test
   ```

### Directory Structure

* [bin](bin) Command-line binary
* [docs](docs) - Markdown project documentation
* [examples](examples) - Markdown samples to illustrate what you can use this for
* [src](src) - Core source files with colocated unit tests

## Terminology

TODO

* [Transclusion](docs/transclusion.md)
* LLM
* Reactive processing
* Hypertext
* Knowledge graphs
* Programming environment
* Live environemnt

## License

TODO
