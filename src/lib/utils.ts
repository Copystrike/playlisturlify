// src/lib/utils.ts
import { nanoid } from 'nanoid'; // Make sure nanoid is installed: npm install nanoid

/**
 * Generates a cryptographically strong, URL-friendly API key.
 * @returns A string representing the API key.
 */
export function generateApiKey(): string {
    // Using a length of 32 characters provides a very high number of possible combinations
    // (64^32 for base64url alphabet), making it extremely difficult to guess.
    return nanoid(32);
}