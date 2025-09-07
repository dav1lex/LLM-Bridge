# LLM Bridge MCP Server

An MCP (Model Context Protocol) server that enables LLM-to-LLM communication through OpenRouter and Google Gemini APIs. This allows one LLM to send prompts to another LLM and receive responses, creating a bridge for AI-to-AI conversations.

## Features

- **OpenRouter Integration**: Connect to various LLMs through OpenRouter API
- **Google Gemini Integration**: Direct integration with Google's Gemini models
- **Multi-turn Conversations**: Support for conversation history and context
- **Flexible Model Selection**: Choose different models for different tasks
- **Token Usage Tracking**: Monitor API usage and costs

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Add your API keys to the `.env` file:
   ```env
   # OpenRouter Configuration
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   OPENROUTER_HTTP_REFERER=http://localhost:3000
   OPENROUTER_X_TITLE=LLM Bridge MCP

   # Google Gemini Configuration
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

## Usage with RovoDev

Add this configuration to your MCP settings:

```json
{
  "llm-bridge": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-llm-bridge"
    ]
  }
}
```

Or if running locally:

```json
{
  "llm-bridge": {
    "command": "node",
    "args": [
      "/path/to/your/llm-bridge/dist/index.js"
    ]
  }
}
```

## Available Tools

### 1. `ask_openrouter_llm`
Send a single prompt to an LLM via OpenRouter.

**Parameters:**
- `prompt` (required): The prompt to send
- `model` (optional): Model to use (default: "anthropic/claude-3-sonnet")
- `max_tokens` (optional): Maximum response tokens (default: 1000)
- `temperature` (optional): Response creativity (0-1, default: 0.7)
- `system_prompt` (optional): System context for the LLM

**Example:**
```json
{
  "prompt": "Explain quantum computing in simple terms",
  "model": "deepseek/deepseek-chat-v3.1:free",
  "max_tokens": 500,
  "temperature": 0.5,
  "system_prompt": "You are a helpful science teacher."
}
```

### 2. `ask_gemini_llm`
Send a single prompt to Google Gemini.

**Parameters:**
- `prompt` (required): The prompt to send
- `model` (optional): Gemini model to use (default: "gemini-pro")
- `max_tokens` (optional): Maximum response tokens (default: 1000)
- `temperature` (optional): Response creativity (0-1, default: 0.7)
- `system_prompt` (optional): System context for the LLM

### 3. `conversation_with_llm`
Have a multi-turn conversation with an LLM.

**Parameters:**
- `messages` (required): Array of conversation messages
- `provider` (optional): "openrouter" or "gemini" (default: "openrouter")
- `model` (optional): Model to use
- `max_tokens` (optional): Maximum response tokens (default: 1000)
- `temperature` (optional): Response creativity (0-1, default: 0.7)

**Example:**
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful coding assistant."},
    {"role": "user", "content": "How do I create a REST API in Python?"},
    {"role": "assistant", "content": "You can use Flask or FastAPI..."},
    {"role": "user", "content": "Show me a FastAPI example"}
  ],
  "provider": "openrouter",
  "model": "anthropic/claude-3-sonnet"
}
```

## Response Format

All tools return a JSON response with:
- `content`: The LLM's response text
- `model`: The model that generated the response
- `provider`: Either "openrouter" or "gemini"
- `usage`: Token usage statistics (when available)

## Popular Models

### OpenRouter Models
- `deepseek/deepseek-chat-v3.1:free`: **FREE** - High quality reasoning model (recommended)
- `anthropic/claude-3-sonnet`: Balanced performance and cost
- `anthropic/claude-3-opus`: Highest quality, more expensive
- `openai/gpt-4`: OpenAI's flagship model
- `openai/gpt-3.5-turbo`: Fast and cost-effective
- `meta-llama/llama-3.1-70b-instruct`: Open source alternative

### Gemini Models
- `gemini-2.0-flash-exp`: **Latest** - Experimental Gemini 2.0 (recommended)
- `gemini-1.5-pro`: High capability model
- `gemini-1.5-flash`: Fast and efficient
- `gemini-pro`: Standard Gemini model

## Development

Run in development mode with auto-rebuild:
```bash
npm run dev
```

## API Keys

### OpenRouter
1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Generate an API key in your dashboard
3. Add credits to your account

### Google Gemini
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Enable the Generative Language API

## Error Handling

The server includes comprehensive error handling for:
- Missing API keys
- Invalid model names
- API rate limits
- Network issues
- Malformed requests

## Security Notes

- Keep your API keys secure and never commit them to version control
- Use environment variables for all sensitive configuration
- Monitor your API usage to avoid unexpected charges
- Consider implementing rate limiting for production use

## License

MIT License - see LICENSE file for details.