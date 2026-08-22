const encoder = new TextEncoder();
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

function send(controller: ReadableStreamDefaultController<Uint8Array>, value: string): boolean {
  try {
    controller.enqueue(encoder.encode(value));
    return true;
  } catch {
    clients.delete(controller);
    return false;
  }
}

export function cleaningEventResponse(signal: AbortSignal): Response {
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let activeController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (activeController) clients.delete(activeController);
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      activeController = controller;
      clients.add(controller);
      send(controller, "retry: 3000\nevent: ready\ndata: connected\n\n");
      heartbeat = setInterval(() => send(controller, ": heartbeat\n\n"), 20_000);
      signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel: cleanup,
  });
  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}

export function publishCleaningChange(): void {
  const message = `event: cleaning\ndata: ${Date.now()}\n\n`;
  for (const controller of clients) send(controller, message);
}
