#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env') });

// Parse command line arguments for preset
const args = process.argv.slice(2);
let selectedPreset = 'general';

// Look for --preset argument
const presetIndex = args.indexOf('--preset');
if (presetIndex !== -1 && args[presetIndex + 1]) {
  selectedPreset = args[presetIndex + 1];
}

// Define preset types
interface PresetConfig {
  provider: 'openrouter' | 'gemini';
  model: string;
  max_tokens: number;
  temperature: number;
  description: string;
}

type PresetName = 'general' | 'coding';

// Define built-in presets
const builtInPresets: Record<PresetName, PresetConfig> = {
  general: {
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat-v3.1:free',
    max_tokens: 8192,
    temperature: 0.7,
    description: 'Balanced settings for general use'
  },
  coding: {
    provider: 'openrouter', 
    model: 'deepseek/deepseek-chat-v3.1:free',
    max_tokens: 8192,
    temperature: 0.1,
    description: 'Optimized for programming tasks with high token limit and low temperature'
  }
};

// example models
const availableModels = {
  openrouter: {
    free: [
      'deepseek/deepseek-chat-v3.1:free',
      'openai/gpt-oss-120b:free',
      'z-ai/glm-4.5-air:free'
    ],
    paid: [
      'moonshotai/kimi-k2-0905',
      'x-ai/grok-code-fast-1'
    ]
  },
  gemini: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash'
  ]
};

// Load custom presets from config file (optional)
let customPresets: Record<string, PresetConfig> = {};
try {
  const configPath = join(process.cwd(), 'mcp-config.json');
  const configFile = JSON.parse(readFileSync(configPath, 'utf8'));
  customPresets = configFile.presets || {};
} catch (error) {
  // Config file is optional, continue with built-in presets only
}

// Combine built-in and custom presets
const allPresets: Record<string, PresetConfig> = { ...builtInPresets, ...customPresets };

// Validate and select preset
if (!allPresets[selectedPreset]) {
  console.error(`Error: Preset "${selectedPreset}" not found.`);
  console.error('Available presets:', Object.keys(allPresets).join(', '));
  process.exit(1);
}

const activePreset = allPresets[selectedPreset];
console.error(`LLM Bridge starting with preset: ${selectedPreset}`);
console.error(`Description: ${activePreset.description}`);
console.error(`Model: ${activePreset.model} (${activePreset.provider})`);
console.error(`Tokens: ${activePreset.max_tokens}, Temperature: ${activePreset.temperature}`);

// Create config object based on selected preset
const mcpConfig = {
  defaults: {
    openrouter: {
      model: activePreset.provider === 'openrouter' ? activePreset.model : 'deepseek/deepseek-chat-v3.1:free',
      max_tokens: activePreset.max_tokens,
      temperature: activePreset.temperature
    },
    gemini: {
      model: activePreset.provider === 'gemini' ? activePreset.model : 'gemini-2.0-flash-exp',
      max_tokens: activePreset.max_tokens,
      temperature: activePreset.temperature
    },
    conversation: {
      provider: activePreset.provider,
      max_tokens: activePreset.max_tokens,
      temperature: activePreset.temperature
    }
  },
  presets: allPresets
};


interface LLMResponse {
  content: string;
  model: string;
  provider: 'openrouter' | 'gemini';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}


class LLMBridgeServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'llm-bridge',
        version: '1.0.0',
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'ask_openrouter_llm',
            description: 'Send a prompt to another LLM via OpenRouter API',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The prompt to send to the LLM',
                },
                model: {
                  type: 'string',
                  description: `The model to use. Available options: ${availableModels.openrouter.free.join(', ')} (free), ${availableModels.openrouter.paid.join(', ')} (paid)`,
                  default: mcpConfig.defaults.openrouter.model,
                },
                max_tokens: {
                  type: 'number',
                  description: 'Maximum tokens in response',
                  default: mcpConfig.defaults.openrouter.max_tokens,
                },
                temperature: {
                  type: 'number',
                  description: 'Temperature for response generation (0-1)',
                  default: mcpConfig.defaults.openrouter.temperature,
                },
                preset: {
                  type: 'string',
                  description: `Use a predefined configuration preset: ${Object.keys(mcpConfig.presets || {}).join(', ')}`,
                },
                system_prompt: {
                  type: 'string',
                  description: 'Optional system prompt to set context',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'ask_gemini_llm',
            description: 'Send a prompt to Google Gemini API',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The prompt to send to Gemini',
                },
                model: {
                  type: 'string',
                  description: `The Gemini model to use. Options: ${availableModels.gemini.join(', ')}`,
                  default: mcpConfig.defaults.gemini.model,
                },
                max_tokens: {
                  type: 'number',
                  description: 'Maximum tokens in response',
                  default: mcpConfig.defaults.gemini.max_tokens,
                },
                temperature: {
                  type: 'number',
                  description: 'Temperature for response generation (0-1)',
                  default: mcpConfig.defaults.gemini.temperature,
                },
                preset: {
                  type: 'string',
                  description: `Use a predefined configuration preset: ${Object.keys(mcpConfig.presets || {}).join(', ')}`,
                },
                system_prompt: {
                  type: 'string',
                  description: 'Optional system prompt to set context',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'conversation_with_llm',
            description: 'Have a multi-turn conversation with another LLM',
            inputSchema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  description: 'Array of conversation messages',
                  items: {
                    type: 'object',
                    properties: {
                      role: {
                        type: 'string',
                        enum: ['user', 'assistant', 'system'],
                      },
                      content: {
                        type: 'string',
                      },
                    },
                    required: ['role', 'content'],
                  },
                },
                provider: {
                  type: 'string',
                  enum: ['openrouter', 'gemini'],
                  description: 'Which provider to use',
                  default: mcpConfig.defaults.conversation.provider,
                },
                model: {
                  type: 'string',
                  description: 'The model to use',
                },
                max_tokens: {
                  type: 'number',
                  default: mcpConfig.defaults.conversation.max_tokens,
                },
                temperature: {
                  type: 'number',
                  default: mcpConfig.defaults.conversation.temperature,
                },
                preset: {
                  type: 'string',
                  description: `Use a predefined configuration preset: ${Object.keys(mcpConfig.presets || {}).join(', ')}`,
                },
              },
              required: ['messages'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'ask_openrouter_llm':
            return await this.handleOpenRouterRequest(args);
          case 'ask_gemini_llm':
            return await this.handleGeminiRequest(args);
          case 'conversation_with_llm':
            return await this.handleConversationRequest(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async handleOpenRouterRequest(args: any) {
    const {
      prompt,
      model = mcpConfig.defaults.openrouter.model,
      max_tokens = mcpConfig.defaults.openrouter.max_tokens,
      temperature = mcpConfig.defaults.openrouter.temperature,
      system_prompt,
      preset,
    } = args;

    // Apply preset if specified
    let finalMaxTokens = max_tokens;
    let finalTemperature = temperature;
    if (preset && allPresets[preset as string]) {
      finalMaxTokens = allPresets[preset as string].max_tokens || max_tokens;
      finalTemperature = allPresets[preset as string].temperature || temperature;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    const messages = [];
    if (system_prompt) {
      messages.push({ role: 'system', content: system_prompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages,
        max_tokens: finalMaxTokens,
        temperature: finalTemperature,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:3000',
          'X-Title': process.env.OPENROUTER_X_TITLE || 'LLM Bridge MCP',
        },
      }
    );

    const result: LLMResponse = {
      content: response.data.choices[0].message.content,
      model: response.data.model,
      provider: 'openrouter',
      usage: response.data.usage,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleGeminiRequest(args: any) {
    const {
      prompt,
      model = mcpConfig.defaults.gemini.model,
      max_tokens = mcpConfig.defaults.gemini.max_tokens,
      temperature = mcpConfig.defaults.gemini.temperature,
      system_prompt,
      preset,
    } = args;

    // Apply preset if specified
    let finalMaxTokens = max_tokens;
    let finalTemperature = temperature;
    if (preset && allPresets[preset as string]) {
      finalMaxTokens = allPresets[preset as string].max_tokens || max_tokens;
      finalTemperature = allPresets[preset as string].temperature || temperature;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    let fullPrompt = prompt;
    if (system_prompt) {
      fullPrompt = `${system_prompt}\n\nUser: ${prompt}`;
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: finalMaxTokens,
          temperature: finalTemperature,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result: LLMResponse = {
      content: response.data.candidates[0].content.parts[0].text,
      model,
      provider: 'gemini',
      usage: {
        prompt_tokens: response.data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.data.usageMetadata?.totalTokenCount || 0,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleConversationRequest(args: any) {
    const {
      messages,
      provider = mcpConfig.defaults.conversation.provider,
      model,
      max_tokens = mcpConfig.defaults.conversation.max_tokens,
      temperature = mcpConfig.defaults.conversation.temperature,
      preset,
    } = args;

    // Apply preset if specified
    let finalMaxTokens = max_tokens;
    let finalTemperature = temperature;
    if (preset && allPresets[preset as string]) {
      finalMaxTokens = allPresets[preset as string].max_tokens || max_tokens;
      finalTemperature = allPresets[preset as string].temperature || temperature;
    }

    if (provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY environment variable is required');
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model || mcpConfig.defaults.openrouter.model,
          messages,
          max_tokens: finalMaxTokens,
          temperature: finalTemperature,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:3000',
            'X-Title': process.env.OPENROUTER_X_TITLE || 'LLM Bridge MCP',
          },
        }
      );

      const result: LLMResponse = {
        content: response.data.choices[0].message.content,
        model: response.data.model,
        provider: 'openrouter',
        usage: response.data.usage,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } else if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }

      // Convert messages to Gemini format
      const contents = messages
        .filter((msg: any) => msg.role !== 'system')
        .map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model || mcpConfig.defaults.gemini.model}:generateContent?key=${apiKey}`,
        {
          contents,
          generationConfig: {
            maxOutputTokens: finalMaxTokens,
            temperature: finalTemperature,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result: LLMResponse = {
        content: response.data.candidates[0].content.parts[0].text,
        model: model || mcpConfig.defaults.gemini.model,
        provider: 'gemini',
        usage: {
          prompt_tokens: response.data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: response.data.usageMetadata?.totalTokenCount || 0,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('LLM Bridge MCP server running on stdio');
  }
}

// Graceful shutdown and error logging
process.on('uncaughtException', (error) => {
  console.error('FATAL: Uncaught exception.', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled promise rejection.', reason);
  process.exit(1);
});

try {
  const server = new LLMBridgeServer();
  server.run().catch(error => {
    console.error('FATAL: Server failed to run.', error);
    process.exit(1);
  });
} catch (error) {
  console.error('FATAL: Failed to initialize server.', error);
  process.exit(1);
}