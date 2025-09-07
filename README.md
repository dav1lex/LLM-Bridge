# LLM Bridge MCP Server

An MCP (Model Context Protocol) server that enables LLM-to-LLM communication through OpenRouter and Google Gemini APIs.

## 🚀 Features

- **Dual Provider Support**: Integrates with both OpenRouter and Google Gemini.
- **Multi-Turn Conversations**: Maintains context for extended dialogues.
- **Configurable Presets**: Easily switch between settings optimized for `general` use and `coding`.
- **High Token Limits**: Supports up to 8192 tokens for handling large codebases and complex discussions.

## 📦 Quick Start

### 1. Create a `.env` File

Create a `.env` file in your project's root directory with your API keys:

```env
# OpenRouter Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_X_TITLE=LLM Bridge MCP

# Google Gemini Configuration
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Configure Your MCP Client

Add the server to your MCP client's configuration. The recommended way is to use `npx` to run the latest version directly from npm.

**Example for RovoDev / RooCode:**

```json
{
  "llm-bridge": {
    "command": "npx",
    "args": [
      "-y",
      "@dav1lex/server-llm-bridge"
    ]
  }
}
```
or locally:

```json
 "llm-bridge": 
 {
 "command": "node",
 "args": [
        "/path/to/your/llm-bridge/dist/index.js"
  ]
}
```
## 🛠️ Available Tools

### 1. `ask_openrouter_llm`

Send a single prompt to an OpenRouter model.

-   **`prompt`** (required): The text to send.
-   **`model`** (optional): e.g., `deepseek/deepseek-chat-v3.1:free`.
-   **`preset`** (optional): Use a predefined configuration (`general` or `coding`).

### 2. `ask_gemini_llm`

Send a single prompt to a Gemini model.

-   **`prompt`** (required): The text to send.
-   **`model`** (optional): e.g., `gemini-2.5-pro`.
-   **`preset`** (optional): Use a predefined configuration (`general` or `coding`).

### 3. `conversation_with_llm`

Have a multi-turn conversation, maintaining context.

-   **`messages`** (required): An array of the conversation history.
-   **`provider`** (optional): `openrouter` or `gemini`.
-   **`model`** (optional): The model to use.

**Example:**

```json
{
  "messages": [
    {
      "role": "user", 
      "content": "What is the capital of France?"
    },
    {
      "role": "assistant",
      "content": "The capital of France is Paris."
    },
    {
      "role": "user",
      "content": "What is a famous landmark there?"
    }
  ],
  "provider": "openrouter",
  "model": "deepseek/deepseek-chat-v3.1:free"
}
```

## 🔧 Development

If you've cloned this repository and want to run your local version:

1.  **Install dependencies**: `npm install`
2.  **Build the code**: `npm run build`
3.  **Run in development mode**: `npm run dev` (auto-rebuilds on changes)

Then, update your MCP client to run the local version with `node`:

```json
{
  "llm-bridge": {
    "command": "node",
    "args": [
      "c:/Users/admin/LLM-Bridge/dist/index.js"
    ]
  }
}
```

## 📄 License

MIT License.