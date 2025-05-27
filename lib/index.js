"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  activate: () => activate
});
module.exports = __toCommonJS(src_exports);
var import_coc2 = require("coc.nvim");

// src/lists.ts
var import_coc = require("coc.nvim");
var DemoList = class extends import_coc.BasicList {
  constructor() {
    super();
    this.name = "demo_list";
    this.description = "CocList for coc-agent";
    this.defaultAction = "open";
    this.actions = [];
    this.addAction("open", (item) => {
      import_coc.window.showInformationMessage(`${item.label}, ${item.data.name}`);
    });
  }
  async loadItems(context) {
    return [
      {
        label: "coc-agent list item 1",
        data: { name: "list item 1" }
      },
      {
        label: "coc-agent list item 2",
        data: { name: "list item 2" }
      }
    ];
  }
};

// src/ai-client.ts
var OpenAIClient = class {
  constructor(config) {
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://api.openai.com/v1",
      model: config.model || "gpt-3.5-turbo",
      maxTokens: config.maxTokens || 100,
      temperature: config.temperature || 0.3
    };
  }
  async getCompletions(request) {
    try {
      const prompt = this.buildPrompt(request);
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: "You are a code completion assistant. Provide helpful code completions based on the context. Return only the completion text without explanations."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          n: request.maxSuggestions || 3,
          stop: ["\n\n", "```"]
        })
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error("Error getting AI completions:", error);
      throw error;
    }
  }
  buildPrompt(request) {
    let prompt = "";
    if (request.language) {
      prompt += `Language: ${request.language}
`;
    }
    if (request.context) {
      prompt += `Context:
${request.context}

`;
    }
    prompt += `Complete the following code:
${request.prompt}`;
    return prompt;
  }
  parseResponse(data) {
    const suggestions = [];
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.message && choice.message.content) {
          const text = choice.message.content.trim();
          if (text) {
            suggestions.push({
              text,
              confidence: this.calculateConfidence(choice),
              type: "completion"
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
        totalTokens: data.usage.total_tokens
      } : void 0
    };
  }
  calculateConfidence(choice) {
    if (choice.finish_reason === "stop") {
      return 0.9;
    } else if (choice.finish_reason === "length") {
      return 0.7;
    }
    return 0.5;
  }
  // Alternative method for legacy completions endpoint
  async getLegacyCompletions(request) {
    try {
      const prompt = this.buildPrompt(request);
      const response = await fetch(`${this.config.baseURL}/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: "text-davinci-003",
          // Use a completion model
          prompt,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          n: request.maxSuggestions || 3,
          stop: ["\n\n"]
        })
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return this.parseLegacyResponse(data);
    } catch (error) {
      console.error("Error getting AI completions:", error);
      throw error;
    }
  }
  parseLegacyResponse(data) {
    const suggestions = [];
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.text) {
          const text = choice.text.trim();
          if (text) {
            suggestions.push({
              text,
              confidence: this.calculateConfidence(choice),
              type: "completion"
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
        totalTokens: data.usage.total_tokens
      } : void 0
    };
  }
};
function createAIClient(config) {
  return new OpenAIClient(config);
}
function getAIConfigFromWorkspace() {
  try {
    const { workspace: workspace2 } = require("coc.nvim");
    const config = workspace2.getConfiguration("coc-agent");
    const apiKey = config.get("openai.apiKey");
    if (!apiKey) {
      return null;
    }
    return {
      apiKey,
      baseURL: config.get("openai.baseURL"),
      model: config.get("openai.model"),
      maxTokens: config.get("openai.maxTokens"),
      temperature: config.get("openai.temperature")
    };
  } catch (error) {
    console.error("Error getting AI config from workspace:", error);
    return null;
  }
}

// src/index.ts
var aiClient = null;
async function activate(context) {
  import_coc2.window.showInformationMessage("coc-agent works!");
  initializeAIClient();
  context.subscriptions.push(
    import_coc2.commands.registerCommand("coc-agent.Command", async () => {
      import_coc2.window.showInformationMessage("coc-agent Commands works!");
    }),
    import_coc2.commands.registerCommand("coc-agent.toggleAI", async () => {
      const config = import_coc2.workspace.getConfiguration("coc-agent");
      const enabled = config.get("ai.enabled", false);
      await config.update("ai.enabled", !enabled, true);
      import_coc2.window.showInformationMessage(`AI completions ${!enabled ? "enabled" : "disabled"}`);
      if (!enabled) {
        initializeAIClient();
      } else {
        aiClient = null;
      }
    }),
    import_coc2.commands.registerCommand("coc-agent.configureAI", async () => {
      const apiKey = await import_coc2.window.requestInput("Enter OpenAI API Key:");
      if (apiKey) {
        const config = import_coc2.workspace.getConfiguration("coc-agent");
        await config.update("openai.apiKey", apiKey, true);
        await config.update("ai.enabled", true, true);
        initializeAIClient();
        import_coc2.window.showInformationMessage("AI configuration updated!");
      }
    }),
    import_coc2.listManager.registerList(new DemoList()),
    import_coc2.sources.createSource({
      name: "coc-agent completion source",
      // unique id
      doComplete: async (opt) => {
        const items = await getCompletionItems(opt);
        return items;
      }
    }),
    import_coc2.workspace.registerKeymap(
      ["n"],
      "agent-keymap",
      async () => {
        import_coc2.window.showInformationMessage("registerKeymap");
      },
      { sync: false }
    ),
    import_coc2.workspace.registerAutocmd({
      event: "InsertLeave",
      request: true,
      callback: () => {
        import_coc2.window.showInformationMessage("registerAutocmd on InsertLeave");
      }
    })
  );
}
function initializeAIClient() {
  const config = getAIConfigFromWorkspace();
  if (config) {
    aiClient = createAIClient(config);
    import_coc2.window.showInformationMessage("AI client initialized");
  } else {
    aiClient = null;
  }
}
async function getCompletionItems(opt) {
  const items = [
    {
      word: "TestCompletionItem 1",
      menu: "[coc-agent]"
    },
    {
      word: "TestCompletionItem 2",
      menu: "[coc-agent]"
    }
  ];
  const config = import_coc2.workspace.getConfiguration("coc-agent");
  const aiEnabled = config.get("ai.enabled", false);
  if (aiEnabled && aiClient && opt) {
    try {
      const aiItems = await getAICompletions(opt);
      items.push(...aiItems);
    } catch (error) {
      console.error("Error getting AI completions:", error);
    }
  }
  return { items };
}
async function getAICompletions(opt) {
  if (!aiClient)
    return [];
  try {
    const { document, position, input } = opt;
    const context = getContextFromDocument(document, position);
    const language = document.languageId;
    const request = {
      prompt: input,
      context,
      language,
      maxSuggestions: 3
    };
    const response = await aiClient.getCompletions(request);
    return response.suggestions.map((suggestion, index) => ({
      word: suggestion.text,
      menu: `[AI-${suggestion.confidence ? Math.round(suggestion.confidence * 100) : 50}%]`,
      kind: "Text",
      sortText: `0${index}`,
      // Prioritize AI suggestions
      detail: `AI suggestion (${response.model || "unknown"})`
    }));
  } catch (error) {
    console.error("Error in getAICompletions:", error);
    return [];
  }
}
function getContextFromDocument(document, position) {
  try {
    const lines = document.textDocument.getText().split("\n");
    const currentLine = position.line;
    const startLine = Math.max(0, currentLine - 5);
    const endLine = Math.min(lines.length - 1, currentLine + 5);
    const contextLines = lines.slice(startLine, endLine + 1);
    return contextLines.join("\n");
  } catch (error) {
    console.error("Error getting context from document:", error);
    return "";
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});
