import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from '../llmProvider';

export class ClaudeApiProvider implements LLMProvider {
  id = 'claude-api';
  name = 'Claude API';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  private getClient(): Anthropic {
    return new Anthropic({ apiKey: this.apiKey });
  }

  async sendMessage(system: string, user: string): Promise<string> {
    const client = this.getClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text || '';
  }

  async sendMessageStream(
    system: string,
    user: string,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const client = this.getClient();
    let fullText = '';

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        onChunk(event.delta.text);
      }
    }

    return fullText;
  }
}
