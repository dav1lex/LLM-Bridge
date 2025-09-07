#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
                  description: 'The model to use. Popular options: "deepseek/deepseek-chat-v3.1:free" (free), "anthropic/claude-3-sonnet", "openai/gpt-4", "meta-llama/llama-3.1-70b-instruct"',
                  default: 'deepseek/deepseek-chat-v3.1:free',
                },
                max_tokens: {
                  type: 'number',
                  description: 'Maximum tokens in response',
                  default: 1000,
                },
                temperature: {
                  type: 'number',
                  description: 'Temperature for response generation (0-1)',
                  default: 0.7,
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
                  description: 'The Gemini model to use. Options: "gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"',
                  default: 'gemini-2.0-flash-exp',
                },
                max_tokens: {
                  type: 'number',
                  description: 'Maximum tokens in response',
                  default: 1000,
                },
                temperature: {
                  type: 'number',
                  description: 'Temperature for response generation (0-1)',
                  default: 0.7,
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
                  default: 'openrouter',
                },
                model: {
                  type: 'string',
                  description: 'The model to use',
                },
                max_tokens: {
                  type: 'number',
                  default: 1000,
                },
                temperature: {
                  type: 'number',
                  default: 0.7,
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
      model = 'deepseek/deepseek-chat-v3.1:free',
      max_tokens = 1000,
      temperature = 0.7,
      system_prompt,
    } = args;

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
        max_tokens,
        temperature,
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
      model = 'gemini-2.0-flash-exp',
      max_tokens = 1000,
      temperature = 0.7,
      system_prompt,
    } = args;

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
          maxOutputTokens: max_tokens,
          temperature,
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
      provider = 'openrouter',
      model,
      max_tokens = 1000,
      temperature = 0.7,
    } = args;

    if (provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY environment variable is required');
      }

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model || 'deepseek/deepseek-chat-v3.1:free',
          messages,
          max_tokens,
          temperature,
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
        `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash-exp'}:generateContent?key=${apiKey}`,
        {
          contents,
          generationConfig: {
            maxOutputTokens: max_tokens,
            temperature,
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
        model: model || 'gemini-2.0-flash-exp',
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

const server = new LLMBridgeServer();
server.run().catch(console.error);