import OpenAI from 'openai';
import type { LLMProvider } from '../llmProvider';

export class OpenAIProvider implements LLMProvider {
  id = 'openai';
  name = 'OpenAI';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  private getClient(): OpenAI {
    return new OpenAI({ apiKey: this.apiKey });
  }

  async sendMessage(system: string, user: string): Promise<string> {
    const client = this.getClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    return response.choices[0]?.message?.content || '';
  }

  async sendMessageStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const client = this.getClient();
    let fullText = '';

    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    }

    return fullText;
  }
}
