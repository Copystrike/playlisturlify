// src/lib/ai.ts
import { ExtractSongDetailsPrompt } from './queryRefinePrompt';
import { GoogleGenAI, Type } from '@google/genai';
import { SongInfo } from '../dto/SongInfo';



/**
 * @todo AI
 * Cleans and refines a song query using a Large Language Model (Gemini).
 * This function takes a raw song title, sends it to the Gemini API with a specific prompt,
 * and parses the structured JSON output to create a refined search query for Spotify.
 *
 * @param songQuery The raw song query string (e.g., "Artist - Title (feat. Other Artist)").
 * @param apiKey The API key for the Google Generative AI service.
 * @returns A refined query string in the format "title artist1 artist2...".
 * If the AI processing fails, it logs a warning and returns the original query.
 */
export async function QueryCleaning(songQuery: string, apiKey: string): Promise<SongInfo> {

    console.log(`QueryCleaning called with songQuery: "${songQuery}"`);

    const prompt = ExtractSongDetailsPrompt(songQuery);

    console.log(`Generated prompt for AI: ${JSON.stringify(prompt)}`);

    const ai = new GoogleGenAI({
        apiKey,
    });

    const config = {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            required: ["title", "artist"],
            properties: {
                title: {
                    type: Type.STRING,
                    description: "Cleaned song title with artist names removed, remix/version info preserved",
                },
                artist: {
                    type: Type.ARRAY,
                    description: "Ordered list of all artists as they appear in the original title",
                    items: {
                        type: Type.STRING,
                    },
                },
            },
        },
    };
    const model = 'gemini-2.0-flash-lite';

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let attempts = 0;
    let parsedResponse = null;

    while (attempts < 3) {
        const response = await ai.models.generateContent({
            model,
            config,
            contents: prompt
        });

        parsedResponse = response.text ? JSON.parse(response.text) : null;

        if (parsedResponse && SongInfo.validate(parsedResponse) && parsedResponse.title) {
            return new SongInfo(parsedResponse.title, parsedResponse.artist);
        }

        attempts++;
        await delay(10000);
    }

    return new SongInfo(songQuery, []);
}