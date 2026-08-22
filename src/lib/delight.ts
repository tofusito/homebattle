import type { Preferences } from "@/hooks/use-preferences";

export function celebrateInteraction(preferences: Preferences): void {
  if (preferences.haptics && "vibrate" in navigator) navigator.vibrate([24, 35, 42]);
  if (!preferences.sound) return;
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
    gain.connect(context.destination);
    for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.055);
      oscillator.stop(context.currentTime + 0.35);
    }
    window.setTimeout(() => void context.close(), 500);
  } catch {
    // Sound is a delight enhancement; unsupported browsers can simply stay quiet.
  }
}
