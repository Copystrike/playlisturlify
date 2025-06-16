export const ExtractSongDetailsPrompt = (query: String) => [
  {
    role: 'user',
    parts: [
      {
        text: `### Remove artist names from song titles

**Delete:**

* Everything **before** \`-\` or \`:\`
* \`(feat. ...)\`, \`(ft. ...)\`, \`(featuring ...)\` **anywhere** in the title

**Keep:**

* Only the actual song name (trim spaces) (No ft or names of artists)

**Return JSON only. No hello. No extra words.**

---

### Examples (DO NOT PROCESS — FAKE DATA)

**Input (Example Only, Do Not Process):**
\`Nebula Vibes (feat. Zeta Ray & Comet Child) [DJ Quanta Remix]\`
**Output:**

\`\`\`json
{
  "title": "Nebula Vibes",
  "artist": ["Zeta Ray", "Comet Child", "DJ Quanta"]
}
\`\`\`

**Input (Example Only, Do Not Process):**
\`Echo Prime - Lunar Drift (ft. Nova Ghost)\`
**Output:**

\`\`\`json
{
  "title": "Lunar Drift",
  "artist": ["Echo Prime", "Nova Ghost"]
}
\`\`\`

**Input (Example Only, Do Not Process):**
\`Synth Fox & Melody Arc - Light Pulse\`
**Output:**

\`\`\`json
{
  "title": "Light Pulse",
  "artist": ["Synth Fox", "Melody Arc"]
}
\`\`\`

**Input (Example Only, Do Not Process):**
\`Crimson Veil: Skybreak (ft. Phantom Note)\`
**Output:**

\`\`\`json
{
  "title": "Skybreak",
  "artist": ["Crimson Veil", "Phantom Note"]
}
\`\`\``,
      },
      {
        text: `# Process with this:

**Input:**
\`${query}\``,
      },
    ],
  },
];