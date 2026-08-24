export type ThemePreference = "system" | "light" | "dark";

// Deben coincidir con --background de styles.css en cada tema.
export const THEME_COLOR_LIGHT = "#f7f5f9";
export const THEME_COLOR_DARK = "#141317";

export function resolveDark(theme: ThemePreference): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: ThemePreference): void {
  if (typeof document === "undefined") return;
  const dark = resolveDark(theme);
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

// Copia inline de applyTheme para el <head>: pinta el tema correcto antes de
// hidratar y evita el destello blanco al abrir la PWA en oscuro.
export const THEME_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("happy-home:preferences")||"{}");var t=p.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${THEME_COLOR_DARK}":"${THEME_COLOR_LIGHT}");}catch(e){}})();`;
