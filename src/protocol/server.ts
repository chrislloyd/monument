export function createMomumentServerHandler(
  generator: AsyncGenerator<Response, void, unknown>,
) {
  // Store the latest response
  let latestResponse: Response | null = null;

  // Flag to track if the generator has completed
  let isGeneratorDone = false;

  // Create a set of controllers for active SSE connections
  const controllers = new Set<ReadableStreamController<string>>();

  // Start the single generator process
  (async () => {
    try {
      for await (const response of generator) {
        // Clone the response before consuming it
        latestResponse = response.clone();

        // Notify all SSE clients about the update (empty event)
        for (const controller of controllers) {
          try {
            controller.enqueue("event: \ndata: \n\n");
          } catch (error) {
            // Connection might be closed, remove this controller
            controllers.delete(controller);
          }
        }
      }

      // Mark generator as completed
      isGeneratorDone = true;

      // Close all SSE connections
      for (const controller of controllers) {
        controller.close();
      }
    } catch (error) {
      console.error("Generator error:", error);
      // Mark generator as completed due to error
      isGeneratorDone = true;

      // Propagate error to all streams
      for (const controller of controllers) {
        controller.error(error);
      }
    } finally {
      controllers.clear();
    }
  })();

  // Return the route handler
  return async (req: Request): Promise<Response> => {
    const acceptHeader = req.headers.get("Accept");
    const wantsSSE = acceptHeader?.includes("text/event-stream");

    if (wantsSSE) {
      // If generator is already done, return a completed stream immediately
      if (isGeneratorDone) {
        console.log("generator finished");
        const stream = new ReadableStream({
          start(controller) {
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      }

      // Handle SSE request for active generator
      const stream = new ReadableStream({
        start(controller) {
          // Send an initial empty event to establish the connection
          controller.enqueue("event: connected\ndata: \n\n");

          // Register this controller to receive future updates
          controllers.add(controller);
        },
        cancel(controller) {
          // Remove the controller when the client disconnects
          controllers.delete(controller);
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // Handle regular GET request
      if (latestResponse === null) {
        console.log("no value yet");
        return new Response(null, { status: 204 });
      }

      // Return a clone of the latest response
      return latestResponse.clone();
    }
  };
}
