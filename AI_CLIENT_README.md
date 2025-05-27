# OpenAI Compatible Client for Autosuggestions

This coc-agent extension now includes an OpenAI compatible client for getting AI-powered autosuggestions while coding.

## Features

- **OpenAI API Integration**: Compatible with OpenAI's chat completions and legacy completions endpoints
- **Context-Aware Completions**: Uses surrounding code context to provide relevant suggestions
- **Configurable Settings**: Customize model, temperature, max tokens, and more
- **Multiple Providers**: Supports any OpenAI-compatible API (OpenAI, Azure OpenAI, local models, etc.)
- **Confidence Scoring**: AI suggestions include confidence scores
- **Language Detection**: Automatically detects programming language for better completions

## Setup

### 1. Configure API Key

You can configure the OpenAI API key in several ways:

#### Option A: Using the command
```
:CocCommand coc-agent.configureAI
```

#### Option B: Using coc-settings.json
Add to your `~/.config/nvim/coc-settings.json`:

```json
{
  "coc-agent.openai.apiKey": "your-api-key-here",
  "coc-agent.ai.enabled": true
}
```

#### Option C: Using environment variable
Set the API key in your shell configuration:
```bash
export OPENAI_API_KEY="your-api-key-here"
```

### 2. Enable AI Completions

```
:CocCommand coc-agent.toggleAI
```

## Configuration Options

All configuration options are available in `coc-settings.json`:

```json
{
  "coc-agent.ai.enabled": false,
  "coc-agent.openai.apiKey": "",
  "coc-agent.openai.baseURL": "https://api.openai.com/v1",
  "coc-agent.openai.model": "gpt-3.5-turbo",
  "coc-agent.openai.maxTokens": 100,
  "coc-agent.openai.temperature": 0.3
}
```

### Configuration Details

- **`ai.enabled`**: Enable/disable AI completions (default: false)
- **`openai.apiKey`**: Your OpenAI API key
- **`openai.baseURL`**: API endpoint URL (useful for Azure OpenAI or local models)
- **`openai.model`**: Model to use (gpt-3.5-turbo, gpt-4, etc.)
- **`openai.maxTokens`**: Maximum tokens for completions (default: 100)
- **`openai.temperature`**: Creativity level 0-2 (default: 0.3 for focused completions)

## Usage

Once configured and enabled, AI completions will automatically appear in your completion menu alongside regular completions. AI suggestions are marked with `[AI-XX%]` where XX is the confidence percentage.

### Commands

- `:CocCommand coc-agent.configureAI` - Set up API key and enable AI
- `:CocCommand coc-agent.toggleAI` - Toggle AI completions on/off

## Supported Providers

This client works with any OpenAI-compatible API:

### OpenAI
```json
{
  "coc-agent.openai.baseURL": "https://api.openai.com/v1",
  "coc-agent.openai.model": "gpt-3.5-turbo"
}
```

### Azure OpenAI
```json
{
  "coc-agent.openai.baseURL": "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
  "coc-agent.openai.model": "gpt-35-turbo"
}
```

### Local Models (Ollama, LM Studio, etc.)
```json
{
  "coc-agent.openai.baseURL": "http://localhost:11434/v1",
  "coc-agent.openai.model": "codellama:7b"
}
```

## API Reference

### OpenAIClient Class

```typescript
import { OpenAIClient, createAIClient } from './ai-client';

const client = createAIClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  maxTokens: 100,
  temperature: 0.3
});

const response = await client.getCompletions({
  prompt: 'function calculateSum(',
  context: 'const numbers = [1, 2, 3, 4, 5];',
  language: 'typescript',
  maxSuggestions: 3
});
```

### Interfaces

```typescript
interface CompletionRequest {
  prompt: string;
  context?: string;
  language?: string;
  maxSuggestions?: number;
}

interface CompletionSuggestion {
  text: string;
  confidence?: number;
  type?: 'completion' | 'suggestion' | 'snippet';
}

interface CompletionResponse {
  suggestions: CompletionSuggestion[];
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

## Troubleshooting

### No AI completions appearing
1. Check that AI is enabled: `:CocCommand coc-agent.toggleAI`
2. Verify API key is set in configuration
3. Check coc.nvim logs: `:CocCommand workspace.showOutput`

### API errors
- Verify your API key is valid
- Check your API quota/billing
- Ensure the base URL is correct for your provider

### Slow completions
- Reduce `maxTokens` setting
- Use a faster model like `gpt-3.5-turbo`
- Consider using a local model for faster responses

## Development

The AI client is implemented in `src/ai-client.ts` and integrated into the main completion source in `src/index.ts`. It supports both the modern chat completions API and legacy completions API for maximum compatibility.

