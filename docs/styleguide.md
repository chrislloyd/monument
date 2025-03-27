# Styleguide

## TypeScript

* Files are namespaces. Prefer singular names.
* Export interfaces for most classes, especially if they deal with side effects
or are platform specific.
* Export classes that are used only in tests with `TestOnly` prefix.
* use `// ---` separator comments liberally.
* When writing a function to convert one type to another, prefer the form "xFromY".

## Tests

* Prefer "test" to "spec" or "it".
* Prefer to not use `describe` blocks.
* Prefer to not use static names, use `Function.prototype.name` to refer to a method/function instead. This means that tests names are resilient to refactoring.
