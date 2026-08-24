import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { PwaRegister } from "../components/PwaRegister";
import { Toaster } from "../components/ui/sonner";
import { THEME_BOOT_SCRIPT } from "../lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Esta página se ha escondido</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No existe o se ha mudado de sitio. La casa sigue estando donde siempre.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver a Happy Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Happy Home no ha podido cargar
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ha ocurrido algo inesperado. Puedes intentarlo de nuevo o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Intentarlo de nuevo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Happy Home" },
      {
        name: "description",
        content: "Labores de casa gamificadas para Lucy y Manu.",
      },
      { name: "theme-color", content: "#f7f5f9" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Happy Home" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "Happy Home" },
      {
        property: "og:description",
        content: "La app cómplice para repartir las labores de casa entre dos.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://happyhome.tofusito.org/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "685" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://happyhome.tofusito.org/og.png" },
    ],
    scripts: [
      // Aplica el tema guardado antes de pintar para evitar el destello claro.
      { children: THEME_BOOT_SCRIPT },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest?v=4" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "64x64",
        href: "/favicon-home-sparkle.png?v=4",
      },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=4" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PwaRegister />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
