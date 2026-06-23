import { createServerFn } from "@tanstack/react-start";

// Asistente de voz para la navegación (ElevenLabs TTS).
// Se ejecuta SOLO en el servidor, por lo que la API key (secreto) nunca llega
// al cliente. Devuelve el audio en base64, o null si no hay key configurada
// (en ese caso el cliente cae a la Web Speech API del navegador).
//
// Configura en el entorno del proyecto (p. ej. secret de Lovable):
//   ELEVENLABS_API_KEY   -> tu API key de ElevenLabs (full access)
//   ELEVENLABS_VOICE_ID  -> (opcional) id de voz en español
export const generarVozServerFn = createServerFn({ method: "POST" })
  .validator((d: { texto: string }) => ({ texto: String(d?.texto ?? "") }))
  .handler(async ({ data }) => {
    const empty = { audio: null as string | null };
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key || !data.texto.trim()) return empty;

    const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: data.texto,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.4, similarity_boost: 0.8 },
          }),
        }
      );
      if (!res.ok) return empty;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const audio =
        typeof btoa !== "undefined"
          ? btoa(bin)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).Buffer?.from(bytes).toString("base64") ?? null;
      return { audio: audio as string | null };
    } catch {
      return empty;
    }
  });
