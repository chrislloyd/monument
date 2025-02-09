export interface Signal<T> {
  get(): T;
}

interface Dependent {
  update(): void;
}

class State<T> implements Signal<T> {
  private dependencies: Set<Dependent> = new Set();

  constructor(private scope: Scope, private value: T, public label = "signal") { }

  get(): T {
    if (this.scope.currentContext) {
      this.addDependency(this.scope.currentContext);
    }
    return this.value;
  }

  set(nextValue: T) {
    if (this.value === nextValue) {
      return;
    }
    this.value = nextValue;
    this.notify()
    this.scope.executeEffects();
  }

  addDependency(thing: Dependent) {
    this.dependencies.add(thing);
  }

  notify() {
    for (const dep of this.dependencies) {
      dep.update();
    }
  }
}

class Computed<T> implements Signal<T>, Dependent {
  value: T | undefined = undefined;
  stale = true;
  dependencies: Set<Dependent> = new Set();

  constructor(
    private scope: Scope,
    private fn: () => T,
  ) { }

  get(): T {
    if (this.stale) {
      const prevContext = this.scope.currentContext;
      this.scope.currentContext = this;
      this.execute();
      this.scope.currentContext = prevContext;
    }
    if (this.scope.currentContext) {
      this.addDependency(this.scope.currentContext);
    }
    return this.value as T;
  }

  execute() {
    this.value = this.fn();
    this.stale = false;
  }

  addDependency(dependent: Dependent) {
    this.dependencies.add(dependent);
  }

  update() {
    if (this.stale) { return; }
    this.stale = true;
    for (const dep of this.dependencies) {
      dep.update();
    }
  }
}

class Effect implements Dependent {
  private stale = true;

  constructor(
    private scope: Scope,
    private fn: () => void
  ) {
    this.execute();
  }

  execute() {
    if (!this.stale) {
      return;
    }
    this.scope.currentContext = this;
    this.fn();
    this.scope.currentContext = null;
  }

  update() {
    this.stale = true;
    this.execute();
  }
}

export class Scope {
  effectQueue: Effect[] = [];
  currentContext: Computed<unknown> | Effect | null = null;

  executeEffects() {
    for (let effect of this.effectQueue) {
      effect.execute();
    }
  }

  state<T>(initialValue: T): State<T> {
    return new State(this, initialValue);
  }

  computed<T>(fn: () => T): Computed<T> {
    return new Computed(this, fn);
  }

  effect(fn: () => void): Effect {
    return new Effect(this, fn);
  }
}
