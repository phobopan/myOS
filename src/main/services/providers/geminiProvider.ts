import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider } from '../llmProvider';

export class GeminiProvider implements LLMProvider {
  id = 'gemini';
  name = 'Google Gemini';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  private getClient(): GoogleGenerativeAI {
    return new GoogleGenerativeAI(this.apiKey);
  }

  async sendMessage(system: string, user: string): Promise<string> {
    const genAI = this.getClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: system,
    });

    const result = await model.generateContent(user);
    return result.response.text();
  }

  async sendMessageStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const genAI = this.getClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: system,
    });

    const result = await model.generateContentStream(user);
    let fullText = '';

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }

    return fullText;
  }
}
