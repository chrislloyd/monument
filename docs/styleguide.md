# Styleguide

## Tests

* Prefer "test" to "spec" or "it".
* Prefer to not use `describe` blocks.
* Prefer to not use static names, use `Function.prototype.name` to refer to a method/function instead. This means that tests names are resilient to refactoring.
