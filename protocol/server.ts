export function createMomumentServerHandler(
  generator: AsyncGenerator<Response, void, unknown>,
) {
  let latestResponse: Response | null = null;
  let isGeneratorDone = false;
  const controllers = new Set<ReadableStreamController<string>>();

  (async () => {
    try {
      for await (const response of generator) {
        latestResponse = response.clone();

        for (const controller of controllers) {
          try {
            controller.enqueue("event: \ndata: \n\n");
          } catch (error) {
            controllers.delete(controller);
          }
        }
      }

      isGeneratorDone = true;
      for (const controller of controllers) {
        controller.close();
      }
    } catch (error) {
      console.error("Generator error:", error);
      isGeneratorDone = true;
      for (const controller of controllers) {
        controller.error(error);
      }
    } finally {
      controllers.clear();
    }
  })();

  return async (req: Request): Promise<Response> => {
    const acceptHeader = req.headers.get("Accept");
    const wantsSSE = acceptHeader?.includes("text/event-stream");

    if (wantsSSE) {
      if (isGeneratorDone) {
        return new Response(null, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      }

      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("event: connected\ndata: \n\n");
          controllers.add(controller);
        },
        cancel(controller) {
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

      return latestResponse.clone();
    }
  };
}
