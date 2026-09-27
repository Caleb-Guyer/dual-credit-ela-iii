// Export the exact game script. Generate audio locally; the deployed game uses static MP3s.
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true } });
try {
  const { missions, questions } = await server.ssrLoadModule('/src/douglass-next/data.ts');
  const key = (speaker, text) => {
    let hash = 2166136261;
    for (const char of speaker + '|' + text) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  };
  const cast = (speaker) =>
    speaker.startsWith('Hugh')
      ? ['am_fenrir', 0.92]
      : speaker.startsWith('An Irish')
        ? ['bm_george', 0.94]
        : speaker.startsWith('A street')
          ? ['am_puck', 1.06]
          : speaker === 'Narrator'
            ? ['af_heart', 1.03]
            : ['am_michael', 0.98];
  const lines = missions.flatMap((m) => m.stages.flatMap((s) => s.lines));
  const add = (text, speaker = 'Narrator') => lines.push({ speaker, text });
  missions.forEach((m) =>
    m.stages.forEach((s) =>
      s.task?.forEach((t) => {
        add(t.instruction);
        add(t.why);
      }),
    ),
  );
  questions.forEach((q) => {
    add(q.prompt);
    add(q.explanation);
  });
  const unique = new Map(
    lines.map((line) => {
      const [voice, speed] = cast(line.speaker);
      return [
        key(line.speaker, line.text),
        { id: key(line.speaker, line.text), speaker: line.speaker, text: line.text, voice, speed },
      ];
    }),
  );
  await writeFile(
    process.argv[2] ?? 'voice-script.json',
    JSON.stringify([...unique.values()], null, 2) + '\n',
  );
  console.log(`${unique.size} source-linked narration, dialogue, and challenge clips exported.`);
} finally {
  await server.close();
}
