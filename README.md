# Alchemy Studio MCP Server

A Model Context Protocol (MCP) server that provides AI-powered image and video generation capabilities through Alchemy Studio's APIs.

## Features
- Image Generation: Create images using Imagen 4 or Gemini 2.5 Flash
- Image Editing: Edit existing images with AI-powered transformations
- Video Generation: Generate videos using Veo 3 (with optional image-to-video)
- Cultural Intelligence: Get cultural insights for any location using Qloo + OpenAI
- Media Management: List and manage generated content from the gallery

## Quick Setup

### 1. Create MCP Server Directory
```bash
# In your Alchemy Studio root directory
mkdir mcp-server
cd mcp-server
```

### 2. Initialize the Project
```bash
# Create package.json (use the provided package.json content)
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk

# Install dev dependencies
npm install -D typescript @types/node
```

### 3. Project Structure
```
mcp-server/
├── src/
│   └── index.ts          # Main MCP server code
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

### 4. Build and Run
```bash
# Build the TypeScript
npm run build

# Start the server
npm start
```

## Environment Variables
The MCP server needs these environment variables:

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional - defaults to http://localhost:3000
ALCHEMY_BASE_URL=http://localhost:3000
```

## Integration with Claude Desktop
Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "alchemy-studio": {
      "command": "node",
      "args": ["/path/to/alchemy-studio/mcp-server/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here",
        "ALCHEMY_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Available Tools

### 1. generate_image
Generate an image from a text prompt.

- **Parameters**:
  - `prompt` (required): Text description of the image
  - `model` (optional): "imagen" or "gemini" (default: "gemini")

### 2. edit_image
Edit an existing image using AI.

- **Parameters**:
  - `prompt` (required): Instructions for editing the image
  - `image_url` (required): URL or base64 data URL of the image

### 3. generate_video
Generate a video using Veo 3.

- **Parameters**:
  - `prompt` (required): Text description of the video
  - `image_url` (optional): Starting image for image-to-video
  - `aspect_ratio` (optional): "16:9", "9:16", or "1:1" (default: "16:9")

### 4. get_cultural_insights
Get cultural intelligence for marketing and localization.

- **Parameters**:
  - `city` (required): Target city
  - `country` (required): Target country
  - `business_type` (optional): Type of business
  - `target_audience` (optional): Target audience description

### 5. list_media
List generated media from the gallery.

- **Parameters**:
  - `type` (optional): "image", "video", or "all" (default: "all")
  - `limit` (optional): Max items to return (default: 10, max: 50)

## Prerequisites
- Alchemy Studio running: The main Next.js app must be running on `http://localhost:3000`
- API Keys configured: Ensure `GEMINI_API_KEY` is set in both the main app and MCP server
- Neo4j Database: If using media management features, ensure Neo4j is configured

## Development
```bash
# Watch mode for development
npm run watch

# Build only
npm run build
```

## Troubleshooting

### Common Issues
- "GEMINI_API_KEY environment variable is required"
  - Ensure the API key is set when running the MCP server
- "Connection refused" errors
  - Make sure Alchemy Studio is running on the correct port
  - Check `ALCHEMY_BASE_URL` environment variable
- Video generation timeouts
  - Video generation can take 2-5 minutes
  - The server will timeout after ~5 minutes of polling

### Debug Mode
Run with debug output:
```bash
DEBUG=* npm start
```

## Security Notes
- The MCP server connects to your local Alchemy Studio instance
- API keys are passed through environment variables
- Generated content is stored locally in the Alchemy Studio database
- No external data is transmitted except to the configured AI APIs

## Next Steps
This is a minimal MCP server implementation. You can extend it by:
- Adding batch operations for multiple images/videos
- Implementing progress tracking for long-running operations
- Adding advanced cultural analysis features
- Creating workflow automation tools
- Adding media search and filtering capabilities

## Support
- **MCP Server**: Check this README and MCP SDK documentation
- **Alchemy Studio APIs**: Refer to the main application documentation
- **AI Models**: Check Google AI documentation for Gemini, Imagen, and Veo
