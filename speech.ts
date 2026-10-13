export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function speak(text: string, rate = 1): void {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  const voices = synth.getVoices();
  const v =
    voices.find((x) => x.lang.replace("_", "-") === "en-US") ||
    voices.find((x) => x.lang.replace("_", "-").startsWith("en-US"));
  if (v) u.voice = v;
  synth.speak(u);
}
