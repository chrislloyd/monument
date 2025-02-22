/**
 * Mini-Shake: A simplified implementation of the Shake build system in TypeScript
 */

// ----- Core Types -----

// Result of building a key
type Result<V> = {
  value: V;
  built: number;         // Timestamp when built
  changed: number;       // Timestamp when last changed
  dependencies: string[]; // List of dependencies
};

// Status of a key in the build system
type Status<V> = 
  | { type: "loaded"; value: V }                        // Initial loaded value
  | { type: "running"; promise: Promise<Result<V>> }    // Currently being computed
  | { type: "ready"; result: Result<V> }                // Successfully computed
  | { type: "failed"; error: Error };                   // Failed to compute

// Options for the build system
type BuildOptions = {
  parallelism: number;        // Maximum number of parallel builds
  verbose: boolean;           // Whether to log build progress
};

// Default build options
const defaultOptions: BuildOptions = {
  parallelism: 4,
  verbose: false,
};

// ----- Rule Types System -----

// Interface for rule types
interface RuleType<K, V> {
  // Function to build a key
  build(
    key: K, 
    need: <T>(key: string) => Promise<T>,
    oldValue?: V,
    changed?: boolean
  ): Promise<V>;
  
  // Function to check if the value has meaningfully changed
  hasChanged(oldValue: V | null, newValue: V): boolean;
  
  // Function to convert key to string (for storage in the database)
  keyToString(key: K): string;
}

// File rule type
class FileRule implements RuleType<string, string> {
  private fs: any; // File system interface
  
  constructor(fs: any) {
    this.fs = fs;
  }
  
  // Convert key to string - for file rules, the key is already a string (the path)
  keyToString(key: string): string {
    return key;
  }
  
  // Check if file contents have meaningfully changed
  hasChanged(oldContents: string | null, newContents: string): boolean {
    return oldContents !== newContents;
  }
  
  // Build a file - this would run the appropriate command and read the file
  async build(
    filePath: string, 
    need: <T>(key: string) => Promise<T>,
    oldContents?: string,
    depsChanged?: boolean
  ): Promise<string> {
    // In a real implementation, this would:
    // 1. Check if the file already exists (and if dependencies haven't changed, return early)
    // 2. Run some command to generate the file
    // 3. Read the file contents and return them
    
    // For simulation, we'll just pretend to generate some content
    console.log(`Generating file: ${filePath}`);
    
    // If dependencies have changed or the file doesn't exist, rebuild it
    if (depsChanged || !oldContents) {
      // Simulate building the file
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        // In a real implementation, this would run a command to generate the file
        // and then read the file contents
        
        // For simulation, we'll just generate some content
        const contents = `Contents of ${filePath} - Generated at ${new Date().toISOString()}`;
        
        // In a real implementation, we would write the file here
        // await this.fs.writeFile(filePath, contents);
        
        return contents;
      } catch (error) {
        console.error(`Error building file ${filePath}:`, error);
        throw error;
      }
    } else {
      console.log(`File ${filePath} is up to date`);
      return oldContents;
    }
  }
}

// Command rule type - for running shell commands
class CommandRule implements RuleType<string, { stdout: string; stderr: string; exitCode: number }> {
  // Convert command to string key
  keyToString(command: string): string {
    return `cmd:${command}`;
  }
  
  // Check if command result has changed
  hasChanged(oldResult: { stdout: string; stderr: string; exitCode: number } | null, 
             newResult: { stdout: string; stderr: string; exitCode: number }): boolean {
    if (!oldResult) return true;
    return oldResult.exitCode !== newResult.exitCode || 
           oldResult.stdout !== newResult.stdout;
  }
  
  // Run a command
  async build(
    command: string, 
    need: <T>(key: string) => Promise<T>,
    oldResult?: { stdout: string; stderr: string; exitCode: number },
    depsChanged?: boolean
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // For simulation, we'll just pretend to run the command
    console.log(`Running command: ${command}`);
    
    // If dependencies have changed or we haven't run before, run the command
    if (depsChanged || !oldResult) {
      // Simulate running the command
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // In a real implementation, this would actually run the command
      // const { stdout, stderr, exitCode } = await execCommand(command);
      
      // For simulation
      const result = {
        stdout: `Output of ${command}`,
        stderr: '',
        exitCode: 0
      };
      
      return result;
    } else {
      console.log(`Command ${command} is up to date`);
      return oldResult;
    }
  }
}

// HTTP request rule type
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// HTTP request configuration
interface HttpRequest {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: string | object;
  timeout?: number;
  cacheControl?: {
    maxAge?: number;  // Cache time in seconds
    etagCheck?: boolean;  // Whether to use ETag for change detection
    useLastModified?: boolean;  // Whether to use Last-Modified for change detection
  };
}

// HTTP response structure
interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  etag?: string;
  lastModified?: string;
}

// HTTP rule implementation
class HttpRule implements RuleType<HttpRequest, HttpResponse> {
  // Convert HTTP request to string key
  keyToString(request: HttpRequest): string {
    const { url, method, body } = request;
    const bodyString = body ? JSON.stringify(body) : '';
    return `http:${method}:${url}:${bodyString}`;
  }
  
  // Check if HTTP response has changed
  hasChanged(oldResponse: HttpResponse | null, newResponse: HttpResponse): boolean {
    if (!oldResponse) return true;
    
    // If caching is explicitly managed through ETag or Last-Modified, use that
    if (oldResponse.etag && newResponse.etag) {
      return oldResponse.etag !== newResponse.etag;
    }
    
    if (oldResponse.lastModified && newResponse.lastModified) {
      return oldResponse.lastModified !== newResponse.lastModified;
    }
    
    // Otherwise compare the data
    return JSON.stringify(oldResponse.data) !== JSON.stringify(newResponse.data);
  }
  
  // Perform an HTTP request
  async build(
    request: HttpRequest,
    need: <T>(key: string) => Promise<T>,
    oldResponse?: HttpResponse,
    depsChanged?: boolean
  ): Promise<HttpResponse> {
    console.log(`HTTP ${request.method} request to ${request.url}`);
    
    // Check if we can use a cached response
    if (!depsChanged && oldResponse && request.cacheControl) {
      const now = Date.now();
      
      // Check max-age cache control
      if (request.cacheControl.maxAge) {
        const responseAge = now - (oldResponse as any).timestamp;
        if (responseAge < request.cacheControl.maxAge * 1000) {
          console.log(`Using cached response for ${request.url} (age: ${responseAge}ms)`);
          return oldResponse;
        }
      }
      
      // For conditional requests, we'd add If-None-Match or If-Modified-Since headers
      if (request.cacheControl.etagCheck && oldResponse.etag) {
        request.headers = {
          ...request.headers,
          'If-None-Match': oldResponse.etag
        };
      }
      
      if (request.cacheControl.useLastModified && oldResponse.lastModified) {
        request.headers = {
          ...request.headers,
          'If-Modified-Since': oldResponse.lastModified
        };
      }
    }
    
    // In a real implementation, we would actually make the HTTP request
    // For simulation, we'll just pretend to do so
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Simulate HTTP response
    // In a real implementation, this would use fetch or another HTTP client
    const response: HttpResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'ETag': `"${Date.now().toString(36)}"`,
        'Last-Modified': new Date().toUTCString()
      },
      data: { 
        result: `Data from ${request.url}`,
        timestamp: Date.now()
      },
      etag: `"${Date.now().toString(36)}"`,
      lastModified: new Date().toUTCString()
    };
    
    // Store the timestamp for cache control
    (response as any).timestamp = Date.now();
    
    return response;
  }
}

// ----- Build System Implementation -----

class Shake {
  private database = new Map<string, Status<any>>();
  private options: BuildOptions;
  private activeBuilds = 0;
  private buildQueue: (() => void)[] = [];
  private ruleTypes = new Map<string, RuleType<any, any>>();
  private rules = new Map<string, { 
    ruleType: string; 
    key: any;
    buildFn?: (need: <T>(key: string) => Promise<T>) => Promise<any>;
  }>();
  
  constructor(options: Partial<BuildOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Register a rule type
   */
  registerRuleType<K, V>(name: string, ruleType: RuleType<K, V>): void {
    this.ruleTypes.set(name, ruleType);
  }
  
  /**
   * Register a specific rule for a key
   */
  registerRule<K, V>(ruleType: string, key: K): string {
    if (!this.ruleTypes.has(ruleType)) {
      throw new Error(`Rule type not registered: ${ruleType}`);
    }
    
    const rt = this.ruleTypes.get(ruleType)!;
    const stringKey = rt.keyToString(key);
    
    if (!this.rules.has(stringKey)) {
      this.rules.set(stringKey, { ruleType, key });
      this.database.set(stringKey, { type: "loaded", value: null });
    }
    
    return stringKey;
  }
  
  /**
   * Register a custom rule with a build function
   */
  rule(key: string, build: (need: <T>(key: string) => Promise<T>) => Promise<any>): void {
    if (!this.rules.has(key)) {
      this.rules.set(key, { ruleType: 'custom', key });
      this.database.set(key, { type: "loaded", value: null });
    }
    
    const rule = this.rules.get(key)!;
    rule.buildFn = build;
  }
  
  /**
   * Get the current dependencies for a key
   */
  private getCurrentDependencies(key: string): string[] | null {
    const entry = this.database.get(key);
    if (!entry) return null;
    
    // Create or get the dependencies list
    if (entry.type === "loaded") {
      if (!(entry as any).dependencies) {
        (entry as any).dependencies = [];
      }
      return (entry as any).dependencies;
    } else if (entry.type === "running") {
      if (!(entry as any).dependencies) {
        (entry as any).dependencies = [];
      }
      return (entry as any).dependencies;
    } else if (entry.type === "ready") {
      return entry.result.dependencies;
    }
    
    return null;
  }
  
  /**
   * Build a key and return its value
   */
  async build<T = any>(key: string): Promise<T> {
    const status = this.database.get(key);
    const rule = this.rules.get(key);
    
    if (!status) {
      throw new Error(`Key not found in database: ${key}`);
    }
    
    if (!rule) {
      throw new Error(`No rule found for key: ${key}`);
    }
    
    // Handle based on current status
    switch (status.type) {
      case "loaded": {
        // We need to build this key
        // Check if we can start a new build
        if (this.activeBuilds >= this.options.parallelism) {
          // Queue this build for later
          await new Promise<void>(resolve => {
            this.buildQueue.push(resolve);
          });
        }
        
        // Start building
        this.activeBuilds++;
        if (this.options.verbose) {
          console.log(`Building: ${key}`);
        }
        
        // Create a promise for this build
        const buildPromise = new Promise<Result<any>>(async (resolve, reject) => {
          try {
            // Create a need function that this rule can use to depend on other keys
            const need = async <DT>(dependencyKey: string): Promise<DT> => {
              // Record this dependency
              const dependencies = this.getCurrentDependencies(key);
              if (dependencies && !dependencies.includes(dependencyKey)) {
                dependencies.push(dependencyKey);
              }
              
              // Build and return the dependency
              return this.build(dependencyKey) as Promise<DT>;
            };
            
            // Check if any dependencies have changed
            const dependencies = (status as any).dependencies || [];
            let depsChanged = false;
            
            for (const dep of dependencies) {
              const depStatus = this.database.get(dep);
              if (depStatus?.type === 'ready' && depStatus.result.changed > 0) {
                depsChanged = true;
                break;
              }
            }
            
            // Get the previous value if any
            const previousValue = status.value;
            
            // Build the value based on the rule type
            let value: any;
            
            if (rule.ruleType === 'custom' && rule.buildFn) {
              // Custom rule with build function
              value = await rule.buildFn(need);
            } else {
              // Rule type from registry
              const ruleType = this.ruleTypes.get(rule.ruleType);
              if (!ruleType) {
                throw new Error(`Rule type not found: ${rule.ruleType}`);
              }
              
              value = await ruleType.build(rule.key, need, previousValue, depsChanged);
            }
            
            // Check if the value has changed
            let hasChanged = true;
            
            if (rule.ruleType !== 'custom' && previousValue !== null) {
              const ruleType = this.ruleTypes.get(rule.ruleType);
              if (ruleType) {
                hasChanged = ruleType.hasChanged(previousValue, value);
              }
            } else {
              // For custom rules, use JSON comparison
              hasChanged = JSON.stringify(previousValue) !== JSON.stringify(value);
            }
            
            // Create the result
            const result: Result<any> = {
              value,
              built: Date.now(),
              changed: hasChanged ? Date.now() : 0,
              dependencies: (status as any).dependencies || [],
            };
            
            resolve(result);
            
            // Update the database
            this.database.set(key, { type: "ready", result });
            
            if (this.options.verbose) {
              console.log(`Completed: ${key} (changed: ${hasChanged})`);
            }
          } catch (error) {
            if (this.options.verbose) {
              console.error(`Failed: ${key}`, error);
            }
            
            // Update the database with the error
            this.database.set(key, { 
              type: "failed", 
              error: error instanceof Error ? error : new Error(String(error)) 
            });
            
            reject(error);
          } finally {
            // Finish this build and maybe start another
            this.activeBuilds--;
            if (this.buildQueue.length > 0) {
              const next = this.buildQueue.shift()!;
              next();
            }
          }
        });
        
        // Update status to running
        this.database.set(key, { type: "running", promise: buildPromise });
        
        // Wait for the build and return the value
        const result = await buildPromise;
        return result.value as T;
      }
      
      case "running":
        // Already building, just wait for it
        try {
          const result = await status.promise;
          return result.value as T;
        } catch (error) {
          throw error;
        }
      
      case "ready":
        // Already built
        return status.result.value as T;
      
      case "failed":
        // Failed before
        throw status.error;
    }
  }
  
  /**
   * Build multiple keys in parallel (apply function in Shake)
   */
  async apply(keys: string[]): Promise<any[]> {
    return Promise.all(keys.map(key => this.build(key)));
  }
  
  /**
   * Clean a single key (mark it as needing to be rebuilt)
   */
  clean(key: string): void {
    const status = this.database.get(key);
    if (status) {
      // Reset to loaded state
      const value = status.type === "loaded" ? status.value : 
                    status.type === "ready" ? status.result.value : null;
      
      const newStatus: Status<any> = { type: "loaded", value };
      this.database.set(key, newStatus);
    }
  }
  
  /**
   * Get information about a key
   */
  getInfo(key: string): { 
    status: string; 
    dependencies: string[]; 
    built?: number; 
    changed?: number;
  } {
    const status = this.database.get(key);
    if (!status) {
      throw new Error(`Key not found: ${key}`);
    }
    
    switch (status.type) {
      case "loaded":
        return { 
          status: "loaded", 
          dependencies: (status as any).dependencies || [] 
        };
      
      case "running":
        return { 
          status: "running", 
          dependencies: (status as any).dependencies || [] 
        };
      
      case "ready":
        return { 
          status: "ready", 
          dependencies: status.result.dependencies,
          built: status.result.built,
          changed: status.result.changed 
        };
      
      case "failed":
        return { 
          status: "failed", 
          dependencies: [] 
        };
    }
  }
}

// ----- Demo Usage -----

// Mock file system for the demo
const mockFS = {
  readFile: async (path: string): Promise<string> => {
    return `Contents of ${path}`;
  },
  writeFile: async (path: string, contents: string): Promise<void> => {
    console.log(`Writing to ${path}: ${contents.substring(0, 20)}...`);
  }
};

async function runDemo() {
  // Create the build system
  const shake = new Shake({ verbose: true });
  
  // Register rule types
  shake.registerRuleType('file', new FileRule(mockFS));
  shake.registerRuleType('command', new CommandRule());
  shake.registerRuleType('http', new HttpRule());
  
  // Register specific rules
  const mainCpp = shake.registerRule('file', 'main.cpp');
  const utilCpp = shake.registerRule('file', 'util.cpp');
  const appExe = shake.registerRule('file', 'app.exe');
  
  // Define a custom rule for app.exe that depends on .cpp files
  shake.rule(appExe, async (need) => {
    // Need both source files
    const mainContent = await need<string>(mainCpp);
    const utilContent = await need<string>(utilCpp);
    
    console.log(`Compiling app.exe with main.cpp (${mainContent.length} bytes) and util.cpp (${utilContent.length} bytes)`);
    
    // In a real build system, this would run the compiler
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Return the "compiled" content
    return `Executable built from ${mainCpp} and ${utilCpp}`;
  });
  
  // Define a command to run the executable
  const runCommand = shake.registerRule('command', './app.exe --test');
  
  // Define a rule for the command that depends on the executable
  shake.rule(runCommand, async (need) => {
    // Need the executable to run the command
    const appContent = await need<string>(appExe);
    
    console.log(`Running ${appContent}`);
    
    // In a real build system, this would run the executable
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return command output
    return {
      stdout: 'Test successful',
      stderr: '',
      exitCode: 0
    };
  });
  
  // Register an HTTP API request with caching
  const apiRequest = shake.registerRule('http', {
    url: 'https://api.example.com/data',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    },
    cacheControl: {
      maxAge: 3600,  // Cache for 1 hour
      etagCheck: true
    }
  });
  
  // Define a rule that depends on both the executable and API data
  const reportRule = shake.rule('report.json', async (need) => {
    // Need both the command result and API data
    const cmdResult = await need<{ stdout: string; stderr: string; exitCode: number }>(runCommand);
    const apiData = await need<HttpResponse>(apiRequest);
    
    console.log(`Generating report with API data and command result`);
    
    // Combine the data
    return {
      testResult: cmdResult.stdout,
      apiData: apiData.data,
      timestamp: Date.now(),
      status: 'success'
    };
  });
  
  // Build and run the executable
  console.log("Starting build...");
  
  // First build
  console.log("\n--- First Build ---");
  const result = await shake.build('report.json');
  console.log("\nReport result:", result);
  
  // Show build info
  console.log("\nBuild info:");
  console.log("main.cpp:", shake.getInfo(mainCpp));
  console.log("util.cpp:", shake.getInfo(utilCpp));
  console.log("app.exe:", shake.getInfo(appExe));
  console.log("run command:", shake.getInfo(runCommand));
  console.log("API request:", shake.getInfo(apiRequest));
  console.log("report.json:", shake.getInfo('report.json'));
  
  // Now rebuild without changes
  console.log("\n--- Rebuild without changes ---");
  const rebuildResult = await shake.build('report.json');
  console.log("\nRebuild result:", rebuildResult);
  
  // Modify a source file and simulate API change
  console.log("\n--- Rebuild after source and API change ---");
  shake.clean(utilCpp); // Mark util.cpp as needing rebuild
  shake.clean(apiRequest); // Mark API as needing refresh
  const afterChangeResult = await shake.build('report.json');
  console.log("\nAfter change result:", afterChangeResult);
  
  // Show final build info
  console.log("\nFinal build info:");
  console.log("main.cpp:", shake.getInfo(mainCpp));
  console.log("util.cpp:", shake.getInfo(utilCpp));
  console.log("app.exe:", shake.getInfo(appExe));
  console.log("run command:", shake.getInfo(runCommand));
  console.log("API request:", shake.getInfo(apiRequest));
  console.log("report.json:", shake.getInfo('report.json'));
}

// Run the demo
runDemo().catch(console.error);
