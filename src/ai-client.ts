const AI_PROVIDER_DEFAULTS = Object.freeze({
  // General defaults - chosen for optimal balance of speed and quality
  MAX_TOKENS: 100,
  TEMPERATURE: 0.3,
  MAX_SUGGESTIONS: 3,
  CONFIDENCE_THRESHOLD: 0.5,
  REQUEST_TIMEOUT_MS: 30000,

  // Provider-specific defaults - encapsulated for maintainability
  OPENAI: Object.freeze({
    BASE_URL: 'https://api.openai.com/v1',
    MODEL: 'gpt-3.5-turbo',
    LEGACY_MODEL: 'text-davinci-003',
    API_VERSION: 'v1',
    CHAT_COMPLETIONS_ENDPOINT: '/chat/completions',
    COMPLETIONS_ENDPOINT: '/completions',
  }),

  CLAUDE: Object.freeze({
    BASE_URL: 'https://api.anthropic.com',
    MODEL: 'claude-3-haiku-20240307',
    API_VERSION: '2023-06-01',
    MESSAGES_ENDPOINT: '/v1/messages',
  }),
} as const);

/**
 * Validation constraints for input parameters.
 */
const VALIDATION_CONSTRAINTS = Object.freeze({
  TEMPERATURE: Object.freeze({
    MIN: 0.0,
    MAX: 1.0,
    DESCRIPTION: 'Controls randomness in AI responses',
  }),
  TOKENS: Object.freeze({
    MIN: 1,
    MAX: 4096,
    DESCRIPTION: 'Maximum number of tokens in AI response',
  }),
  SUGGESTIONS: Object.freeze({
    MIN: 1,
    MAX: 10,
    DESCRIPTION: 'Number of completion suggestions to generate',
  }),
  PROMPT_LENGTH: Object.freeze({
    MIN: 1,
    MAX: 8000,
    DESCRIPTION: 'Maximum length of input prompt in characters',
  }),
  API_KEY_LENGTH: Object.freeze({
    MIN: 10,
    MAX: 200,
    DESCRIPTION: 'Expected length range for API keys',
  }),
} as const);

const ERROR_MESSAGES = Object.freeze({
  INVALID_API_KEY: 'API key is required and must be a non-empty string',
  INVALID_TEMPERATURE: `Temperature must be between ${VALIDATION_CONSTRAINTS.TEMPERATURE.MIN} and ${VALIDATION_CONSTRAINTS.TEMPERATURE.MAX}`,
  INVALID_MAX_TOKENS: 'Max tokens must be a positive number',
  INVALID_PROMPT: 'Prompt is required and must be a non-empty string',
  INVALID_MAX_SUGGESTIONS: 'Max suggestions must be a positive number',
  NETWORK_ERROR: 'Network error: Unable to connect to AI service',
  UNEXPECTED_ERROR: 'Unexpected error occurred',
  PROVIDER_NOT_SUPPORTED: 'AI provider is not supported',
  CONFIGURATION_ERROR: 'Configuration error',
} as const);

// ============================================================================
// Type Definitions and Interfaces
// ============================================================================

export type AIProvider = 'openai' | 'claude';

export type CompletionType = 'completion' | 'suggestion' | 'snippet';

interface BaseAIConfig {
  /** API key for authentication - required for all providers */
  readonly apiKey: string;
  /** Custom base URL for API endpoint (optional) */
  readonly baseURL?: string;
  /** Model name to use (optional, provider-specific defaults apply) */
  readonly model?: string;
  /** Maximum tokens in response (optional, default: 100) */
  readonly maxTokens?: number;
  /** Temperature for response randomness 0.0-1.0 (optional, default: 0.3) */
  readonly temperature?: number;
}

export interface OpenAIConfig extends BaseAIConfig {
  readonly baseURL?: string;
  readonly model?: string;
}

export interface ClaudeConfig extends BaseAIConfig {
  readonly baseURL?: string;
  readonly model?: string;
}

export type AIConfig = OpenAIConfig | ClaudeConfig;

export interface AIProviderConfig {
  readonly provider: AIProvider;
  readonly config: AIConfig;
}

export interface CompletionRequest {
  /** The code prompt to complete - required */
  readonly prompt: string;
  /** Additional context for better completions (optional) */
  readonly context?: string;
  /** Programming language for syntax-aware completions (optional) */
  readonly language?: string;
  /** Maximum number of suggestions to return (optional, default: 1) */
  readonly maxSuggestions?: number;
}

export interface CompletionSuggestion {
  /** The suggested completion text */
  readonly text: string;
  /** Confidence score 0.0-1.0 (optional) */
  readonly confidence?: number;
  /** Type of suggestion (optional) */
  readonly type?: CompletionType;
}

/**
 * Token usage statistics for cost tracking and optimization
 */
export interface TokenUsage {
  /** Tokens used in the prompt */
  readonly promptTokens: number;
  /** Tokens used in the completion */
  readonly completionTokens: number;
  /** Total tokens used */
  readonly totalTokens: number;
}
export interface CompletionResponse {
  /** Array of completion suggestions */
  readonly suggestions: CompletionSuggestion[];
  /** Model used for completion (optional) */
  readonly model?: string;
  /** Token usage statistics (optional) */
  readonly usage?: TokenUsage;
}

export class AIClientError extends Error {
  constructor(
    message: string,
    public readonly provider: AIProvider,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AIClientError';
  }
}

abstract class BaseAIClient {
  protected readonly config: Required<BaseAIConfig>;
  protected readonly provider: AIProvider;

  constructor(config: BaseAIConfig, provider: AIProvider) {
    this.validateConfig(config);
    this.config = this.normalizeConfig(config);
    this.provider = provider;
  }

  /**
   * Main method for getting code completions
   */
  async getCompletions(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      this.validateRequest(request);
      const prompt = this.buildPrompt(request);
      const apiResponse = await this.callAPI(prompt, request);
      return this.parseResponse(apiResponse, request.maxSuggestions || AI_DEFAULTS.MAX_SUGGESTIONS);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private validateConfig(config: BaseAIConfig): void {
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      throw new AIClientError('API key is required and must be a non-empty string', this.provider);
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
      throw new AIClientError('Temperature must be between 0.0 and 1.0', this.provider);
    }

    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      throw new AIClientError('Max tokens must be a positive number', this.provider);
    }
  }

  private validateRequest(request: CompletionRequest): void {
    if (!request.prompt || typeof request.prompt !== 'string' || request.prompt.trim() === '') {
      throw new AIClientError('Prompt is required and must be a non-empty string', this.provider);
    }

    if (request.maxSuggestions !== undefined && request.maxSuggestions <= 0) {
      throw new AIClientError('Max suggestions must be a positive number', this.provider);
    }
  }

  protected abstract normalizeConfig(config: BaseAIConfig): Required<BaseAIConfig>;

  protected buildPrompt(request: CompletionRequest): string {
    const promptParts: string[] = [];

    if (request.language) {
      promptParts.push(`Language: ${request.language}`);
    }

    if (request.context) {
      promptParts.push(`Context:\n${request.context}`);
    }

    promptParts.push(`Complete the following code:\n${request.prompt}`);

    return promptParts.join('\n\n');
  }

  protected abstract callAPI(prompt: string, request: CompletionRequest): Promise<any>;

  protected abstract parseResponse(data: any, maxSuggestions: number): CompletionResponse;

  protected handleError(error: any): AIClientError {
    if (error instanceof AIClientError) {
      return error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new AIClientError(
        'Network error: Unable to connect to AI service',
        this.provider,
        undefined,
        error
      );
    }

    return new AIClientError(
      `Unexpected error: ${error.message || 'Unknown error'}`,
      this.provider,
      undefined,
      error
    );
  }

export class ClaudeClient {
  private config: Required<ClaudeConfig>;

  constructor(config: ClaudeConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.anthropic.com',
      model: config.model || 'claude-3-haiku-20240307',
      maxTokens: config.maxTokens || 100,
      temperature: config.temperature || 0.3,
    };
  }

  async getCompletions(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const prompt = this.buildPrompt(request);

      const response = await fetch(`${this.config.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          system: 'You are a code completion assistant. Provide helpful code completions based on the context. Return only the completion text without explanations.',
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return this.parseResponse(data, request.maxSuggestions || 3);
    } catch (error) {
      console.error('Error getting Claude completions:', error);
      throw error;
    }
  }

  private buildPrompt(request: CompletionRequest): string {
    let prompt = '';

    if (request.language) {
      prompt += `Language: ${request.language}\n`;
    }

    if (request.context) {
      prompt += `Context:\n${request.context}\n\n`;
    }

    prompt += `Complete the following code:\n${request.prompt}`;

    return prompt;
  }

  private parseResponse(data: any, maxSuggestions: number): CompletionResponse {
    const suggestions: CompletionSuggestion[] = [];

    if (data.content && Array.isArray(data.content)) {
      for (const content of data.content) {
        if (content.type === 'text' && content.text) {
          const text = content.text.trim();
          if (text) {
            // Split the response into multiple suggestions if possible
            const lines = text.split('\n').filter(line => line.trim());
            const numSuggestions = Math.min(lines.length, maxSuggestions);

            for (let i = 0; i < numSuggestions; i++) {
              suggestions.push({
                text: lines[i].trim(),
                confidence: 0.9 - (i * 0.1), // Decreasing confidence for subsequent suggestions
                type: 'completion',
              });
            }
            break; // Only process the first text content
          }
        }
      }
    }

    // If we didn't get enough suggestions, add the full text as a single suggestion
    if (suggestions.length === 0 && data.content && data.content[0] && data.content[0].text) {
      suggestions.push({
        text: data.content[0].text.trim(),
        confidence: 0.9,
        type: 'completion',
      });
    }

    return {
      suggestions,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
        totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      } : undefined,
    };
  }
}

export class OpenAIClient {
  private config: Required<OpenAIConfig>;

  constructor(config: OpenAIConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.openai.com/v1',
      model: config.model || 'gpt-3.5-turbo',
      maxTokens: config.maxTokens || 100,
      temperature: config.temperature || 0.3,
    };
  }

  async getCompletions(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const prompt = this.buildPrompt(request);

      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a code completion assistant. Provide helpful code completions based on the context. Return only the completion text without explanations.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          n: request.maxSuggestions || 3,
          stop: ['\n\n', '```'],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return this.parseResponse(data);
    } catch (error) {
      console.error('Error getting AI completions:', error);
      throw error;
    }
  }

  private buildPrompt(request: CompletionRequest): string {
    let prompt = '';

    if (request.language) {
      prompt += `Language: ${request.language}\n`;
    }

    if (request.context) {
      prompt += `Context:\n${request.context}\n\n`;
    }

    prompt += `Complete the following code:\n${request.prompt}`;

    return prompt;
  }

  private parseResponse(data: any): CompletionResponse {
    const suggestions: CompletionSuggestion[] = [];

    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.message && choice.message.content) {
          const text = choice.message.content.trim();
          if (text) {
            suggestions.push({
              text,
              type: 'completion',
            });
          }
        }
      }
    }

    return {
      suggestions,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  async getLegacyCompletions(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const prompt = this.buildPrompt(request);

      const response = await fetch(`${this.config.baseURL}/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-davinci-003', // Use a completion model
          prompt,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          n: request.maxSuggestions || 3,
          stop: ['\n\n'],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return this.parseLegacyResponse(data);
    } catch (error) { console.error('Error getting AI completions:', error);
      throw error;
    }
  }

  private parseLegacyResponse(data: any): CompletionResponse {
    const suggestions: CompletionSuggestion[] = [];

    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.text) {
          const text = choice.text.trim();
          if (text) {
            suggestions.push({
              text,
              type: 'completion',
            });
          }
        }
      }
    }

    return {
      suggestions,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}

export function createAIClient(providerConfig: AIProviderConfig): OpenAIClient | ClaudeClient {
  if (providerConfig.provider === 'claude') {
    return new ClaudeClient(providerConfig.config as ClaudeConfig);
  } else {
    return new OpenAIClient(providerConfig.config as OpenAIConfig);
  }
}

export function getAIConfigFromWorkspace(): AIProviderConfig | null {
  try {
    const { workspace } = require('coc.nvim');
    const config = workspace.getConfiguration('coc-agent');

    const provider = config.get<string>('provider', 'openai') as 'openai' | 'claude';

    if (provider === 'claude') {
      const apiKey = config.get<string>('claude.apiKey');
      if (!apiKey) {
        return null;
      }

      return {
        provider: 'claude',
        config: {
          apiKey,
          baseURL: config.get<string>('claude.baseURL'),
          model: config.get<string>('claude.model'),
          maxTokens: config.get<number>('claude.maxTokens'),
          temperature: config.get<number>('claude.temperature'),
        } as ClaudeConfig,
      };
    } else {
      const apiKey = config.get<string>('openai.apiKey');
      if (!apiKey) {
        return null;
      }

      return {
        provider: 'openai',
        config: {
          apiKey,
          baseURL: config.get<string>('openai.baseURL'),
          model: config.get<string>('openai.model'),
          maxTokens: config.get<number>('openai.maxTokens'),
          temperature: config.get<number>('openai.temperature'),
        } as OpenAIConfig,
      };
    }
  } catch (error) {
    console.error('Error getting AI config from workspace:', error);
    return null;
  }
}
