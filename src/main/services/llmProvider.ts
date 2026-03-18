/**
 * LLM Provider interface — all providers implement this contract.
 */
export interface LLMProvider {
  id: string; // 'claude-cli' | 'claude-api' | 'openai' | 'gemini'
  name: string;
  sendMessage(system: string, user: string): Promise<string>;
  sendMessageStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
  ): Promise<string>;
  isAvailable(): Promise<boolean>;
}
