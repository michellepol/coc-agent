import { commands, CompleteResult, ExtensionContext, listManager, sources, window, workspace, Document, Position } from 'coc.nvim';
import DemoList from './lists';
import { OpenAIClient, createAIClient, getAIConfigFromWorkspace, CompletionRequest } from './ai-client';

let aiClient: OpenAIClient | null = null;

export async function activate(context: ExtensionContext): Promise<void> {
  window.showInformationMessage('coc-agent works!');

  // Initialize AI client if configured
  initializeAIClient();

  context.subscriptions.push(
    commands.registerCommand('coc-agent.Command', async () => {
      window.showInformationMessage('coc-agent Commands works!');
    }),

    commands.registerCommand('coc-agent.toggleAI', async () => {
      const config = workspace.getConfiguration('coc-agent');
      const enabled = config.get<boolean>('ai.enabled', false);
      await config.update('ai.enabled', !enabled, true);
      window.showInformationMessage(`AI completions ${!enabled ? 'enabled' : 'disabled'}`);

      if (!enabled) {
        initializeAIClient();
      } else {
        aiClient = null;
      }
    }),

    commands.registerCommand('coc-agent.configureAI', async () => {
      const apiKey = await window.requestInput('Enter OpenAI API Key:');
      if (apiKey) {
        const config = workspace.getConfiguration('coc-agent');
        await config.update('openai.apiKey', apiKey, true);
        await config.update('ai.enabled', true, true);
        initializeAIClient();
        window.showInformationMessage('AI configuration updated!');
      }
    }),

    listManager.registerList(new DemoList()),

    sources.createSource({
      name: 'coc-agent completion source', // unique id
      doComplete: async (opt) => {
        const items = await getCompletionItems(opt);
        return items;
      },
    }),

    workspace.registerKeymap(
      ['n'],
      'agent-keymap',
      async () => {
        window.showInformationMessage('registerKeymap');
      },
      { sync: false }
    ),

    workspace.registerAutocmd({
      event: 'InsertLeave',
      request: true,
      callback: () => {
        window.showInformationMessage('registerAutocmd on InsertLeave');
      },
    })
  );
}

function initializeAIClient(): void {
  const config = getAIConfigFromWorkspace();
  if (config) {
    aiClient = createAIClient(config);
    window.showInformationMessage('AI client initialized');
  } else {
    aiClient = null;
  }
}

async function getCompletionItems(opt?: any): Promise<CompleteResult> {
  const items: any[] = [];

  // Add AI-powered completions if enabled and configured
  const config = workspace.getConfiguration('coc-agent');
  const aiEnabled = config.get<boolean>('ai.enabled', false);

  if (aiEnabled && aiClient && opt) {
    try {
      const aiItems = await getAICompletions(opt);
      items.push(...aiItems);
    } catch (error) {
      console.error('Error getting AI completions:', error);
    }
  }

  return { items };
}

async function getAICompletions(opt: any): Promise<any[]> {
  if (!aiClient) return [];

  try {
    const { document, position, input } = opt;

    // Get context around the cursor
    const context = getContextFromDocument(document, position);
    const language = document.languageId;

    const request: CompletionRequest = {
      prompt: input,
      context,
      language,
      maxSuggestions: 3,
    };

    const response = await aiClient.getCompletions(request);

    return response.suggestions.map((suggestion, index) => ({
      word: suggestion.text,
      menu: `[AI-${suggestion.confidence ? Math.round(suggestion.confidence * 100) : 50}%]`,
      kind: 'Text',
      sortText: `0${index}`, // Prioritize AI suggestions
      detail: `AI suggestion (${response.model || 'unknown'})`,
    }));
  } catch (error) {
    console.error('Error in getAICompletions:', error);
    return [];
  }
}

function getContextFromDocument(document: Document, position: Position): string {
  try {
    const lines = document.textDocument.getText().split('\n');
    const currentLine = position.line;

    // Get 5 lines before and after current position for context
    const startLine = Math.max(0, currentLine - 5);
    const endLine = Math.min(lines.length - 1, currentLine + 5);

    const contextLines = lines.slice(startLine, endLine + 1);
    return contextLines.join('\n');
  } catch (error) {
    console.error('Error getting context from document:', error);
    return '';
  }
}
