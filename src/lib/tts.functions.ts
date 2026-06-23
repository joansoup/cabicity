import { createServerFn } from "@tanstack/react-start";

// TTS con la voz de Rosalía creada por el usuario en ElevenLabs.
const ROSALIA_VOICE_ID = "0yjozmPXw5c7i43fUMkY";

export const speakRosalia = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string }) => {
    if (!data || typeof data.text !== "string" || !data.text.trim()) {
      throw new Error("text es requerido");
    }
    return { text: data.text.slice(0, 1000) };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY no configurada");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ROSALIA_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`ElevenLabs TTS falló: ${res.status} ${err}`);
    }

    const buf = await res.arrayBuffer();
    const audioBase64 = Buffer.from(buf).toString("base64");
    return { audioBase64, mime: "audio/mpeg" };
  });
