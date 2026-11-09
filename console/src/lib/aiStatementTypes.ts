/** The exact change to a prompt, as lib/ai-statement.js's promptDiff returns it. Client-safe. */
export interface AiStatementDiff {
  line: number;
  contextBefore: string[];
  removed: string[];
  added: string[];
  contextAfter: string[];
}
