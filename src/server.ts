import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { closeDatabase, pingDatabase } from "./server/database.server";
import {
  cleaningEventResponse,
  closeAllEventStreams,
  sseClientCount,
} from "./server/events.server";
import { startReminderScheduler } from "./server/reminders.server";

let shutdownRegistered = false;

function registerGracefulShutdown(): void {
  if (shutdownRegistered || typeof process === "undefined") return;
  shutdownRegistered = true;
  const cleanup = () => {
    closeAllEventStreams();
    void closeDatabase();
  };
  process.once("SIGTERM", cleanup);
  process.once("SIGINT", cleanup);
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      registerGracefulShutdown();
      startReminderScheduler();
      const url = new URL(request.url);
      if (url.pathname === "/healthz") {
        await pingDatabase();
        if (url.searchParams.get("verbose") === "1") {
          return Response.json({
            status: "ok",
            uptimeSeconds: Math.round(process.uptime()),
            sseClients: sseClientCount(),
          });
        }
        return new Response("ok", { headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      if (url.pathname === "/api/events" && request.method === "GET") {
        return cleaningEventResponse(request.signal);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-content-type-options": "nosniff",
          "referrer-policy": "strict-origin-when-cross-origin",
        },
      });
    }
  },
};
