class AssertionError extends Error {
  code = "ERR_ASSERTION";

  constructor(
    message: string,
    public actual?: unknown | undefined,
    public expected?: unknown | undefined,
    public operator?: string | undefined,
  ) {
    super(message);
  }
}

export function fail(message?: string): never {
  throw new AssertionError(message ?? "Failed", undefined, undefined, "fail");
}

export function ok(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new AssertionError(
      message ?? "Expected value to be truthy",
      value,
      true,
      "==",
    );
  }
}

export function equal<T>(
  actual: unknown,
  expected: T,
  message?: string,
): asserts actual is T {
  if (Object.is(actual, expected)) {
    throw new AssertionError(
      message ?? `Expected ${actual} to equal ${expected}`,
      actual,
      expected,
      "strictEqual",
    );
  }
}
