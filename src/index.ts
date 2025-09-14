#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Environment setup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = process.env.ALCHEMY_BASE_URL || 'http://localhost:3000';

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

class AlchemyMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'alchemy-studio',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'generate_image',
            description: 'Generate an image using Imagen 4 or Gemini 2.5 Flash',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Text prompt describing the image to generate',
                },
                model: {
                  type: 'string',
                  enum: ['imagen', 'gemini'],
                  description: 'Model to use for generation',
                  default: 'gemini',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'edit_image',
            description: 'Edit an existing image using AI',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Instructions for how to edit the image',
                },
                image_url: {
                  type: 'string',
                  description: 'URL or base64 data URL of the image to edit',
                },
              },
              required: ['prompt', 'image_url'],
            },
          },
          {
            name: 'generate_video',
            description: 'Generate a video using Veo 3',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Text prompt describing the video to generate',
                },
                image_url: {
                  type: 'string',
                  description: 'Optional: URL of starting image for image-to-video',
                },
                aspect_ratio: {
                  type: 'string',
                  enum: ['16:9', '9:16', '1:1'],
                  description: 'Video aspect ratio',
                  default: '16:9',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'get_cultural_insights',
            description: 'Get cultural intelligence for a location using Qloo + OpenAI',
            inputSchema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'Target city',
                },
                country: {
                  type: 'string',
                  description: 'Target country',
                },
                business_type: {
                  type: 'string',
                  description: 'Type of business (optional)',
                },
                target_audience: {
                  type: 'string',
                  description: 'Target audience description (optional)',
                },
              },
              required: ['city', 'country'],
            },
          },
          {
            name: 'list_media',
            description: 'List generated media from the gallery',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['image', 'video', 'all'],
                  description: 'Filter by media type',
                  default: 'all',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of items to return',
                  default: 10,
                  maximum: 50,
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'generate_image':
            return await this.generateImage(request.params.arguments);
          case 'edit_image':
            return await this.editImage(request.params.arguments);
          case 'generate_video':
            return await this.generateVideo(request.params.arguments);
          case 'get_cultural_insights':
            return await this.getCulturalInsights(request.params.arguments);
          case 'list_media':
            return await this.listMedia(request.params.arguments);
          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
        };
      }
    });
  }

  private async generateImage(args: any) {
    const { prompt, model = 'gemini' } = args;
    
    const endpoint = model === 'imagen' ? '/api/imagen/generate' : '/api/gemini/generate';
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if ((data as any).error) {
      throw new Error((data as any).error);
    }

    const imageUrl = (data as any).image?.url || `data:${(data as any).image?.mimeType};base64,${(data as any).image?.imageBytes}`;
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Image generated successfully using ${model}\n\nPrompt: ${prompt}\n\nImage URL: ${imageUrl}`,
        },
      ],
    };
  }

  private async editImage(args: any) {
    const { prompt, image_url } = args;

    // Convert URL to file if needed
    let imageFile: File;
    if (String(image_url).startsWith('data:')) {
      // Handle base64 data URL
      const [header, base64] = String(image_url).split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
      const buffer = Buffer.from(base64, 'base64');
      imageFile = new File([buffer], 'image.png', { type: mimeType } as any);
    } else {
      // Fetch from URL
      const imageResponse = await fetch(String(image_url));
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }
      const buffer = await imageResponse.arrayBuffer();
      imageFile = new File([buffer], 'image.png', { type: 'image/png' } as any);
    }

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('imageFile', imageFile);

    const response = await fetch(`${BASE_URL}/api/gemini/edit`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if ((data as any).error) {
      throw new Error((data as any).error);
    }

    const resultUrl = (data as any).image?.url || `data:${(data as any).image?.mimeType};base64,${(data as any).image?.imageBytes}`;
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Image edited successfully\n\nEdit instructions: ${prompt}\n\nResult URL: ${resultUrl}`,
        },
      ],
    };
  }

  private async generateVideo(args: any) {
    const { prompt, image_url, aspect_ratio = '16:9' } = args;

    // Start video generation
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('model', 'veo-3.0-generate-001');
    formData.append('aspectRatio', aspect_ratio);

    if (image_url) {
      if (String(image_url).startsWith('data:')) {
        const [header, base64] = String(image_url).split(',');
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
        formData.append('imageBase64', base64);
        formData.append('imageMimeType', mimeType);
      } else {
        // For simplicity, we'll pass the URL - the API would need to handle this
        formData.append('imageUrl', String(image_url));
      }
    }

    const generateResponse = await fetch(`${BASE_URL}/api/veo/generate`, {
      method: 'POST',
      body: formData,
    });

    if (!generateResponse.ok) {
      throw new Error(`Generate API error: ${generateResponse.status}`);
    }

    const generateData = await generateResponse.json();
    const operationName = (generateData as any).name;

    if (!operationName) {
      throw new Error('No operation name returned from video generation');
    }

    // Poll for completion (simplified)
    let attempts = 0;
    const maxAttempts = 30; // ~5 minutes with 10s intervals
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const pollResponse = await fetch(`${BASE_URL}/api/veo/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: operationName }),
      });

      if (pollResponse.ok) {
        const pollData = await pollResponse.json();
        
        if ((pollData as any).done) {
          // Extract video URI
          const fileUri = (pollData as any).response?.candidates?.[0]?.content?.parts?.[0]?.file_data?.file_uri ||
                          (pollData as any).uris?.[0];
          
          if (fileUri) {
            // Download and save video
            const downloadResponse = await fetch(`${BASE_URL}/api/veo/download`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uri: fileUri, save: true }),
            });

            if (downloadResponse.ok) {
              const downloadData = await downloadResponse.json();
              return {
                content: [
                  {
                    type: 'text',
                    text: `✅ Video generated successfully\n\nPrompt: ${prompt}\n\nVideo URL: ${(downloadData as any).url}\n\nAspect Ratio: ${aspect_ratio}`,
                  },
                ],
              };
            }
          }
        }
      }
      
      attempts++;
    }

    return {
      content: [
        {
          type: 'text',
          text: `⏳ Video generation started but timed out waiting for completion.\n\nOperation: ${operationName}\n\nCheck the gallery in a few minutes.`,
        },
      ],
    };
  }

  private async getCulturalInsights(args: any) {
    const { city, country, business_type, target_audience } = args;

    const response = await fetch(`${BASE_URL}/api/cultural/intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city,
        country,
        businessType: business_type,
        targetAudience: target_audience,
        analysisDepth: 'basic',
      }),
    });

    if (!response.ok) {
      throw new Error(`Cultural API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!(data as any).analysis) {
      throw new Error((data as any).error || 'Cultural analysis failed');
    }

    const analysis = (data as any).analysis;
    const brands = (data as any).raw?.qloo?.brands?.slice(0, 5) || [];
    const places = (data as any).raw?.qloo?.places?.slice(0, 5) || [];

    return {
      content: [
        {
          type: 'text',
          text: `🌍 Cultural Insights for ${city}, ${country}\n\n` +
                `Profile: ${JSON.stringify(analysis.profile, null, 2)}\n\n` +
                `Communication: ${JSON.stringify(analysis.communication, null, 2)}\n\n` +
                `Aesthetics: ${JSON.stringify(analysis.aesthetics, null, 2)}\n\n` +
                `Popular Brands: ${brands.map((b: any) => b.name).join(', ')}\n\n` +
                `Notable Places: ${places.map((p: any) => p.name).join(', ')}`,
        },
      ],
    };
  }

  private async listMedia(args: any) {
    const { type = 'all', limit = 10 } = args;

    const params = new URLSearchParams();
    if (type !== 'all') params.append('type', type);
    params.append('limit', String(limit));

    const response = await fetch(`${BASE_URL}/api/media?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Media API error: ${response.status}`);
    }

    const data = await response.json();
    const media = (data as any).media || [];

    if (media.length === 0) {
      return {
        content: [
          { type: 'text', text: '📂 No media found in gallery' },
        ],
      };
    }

    const mediaList = media
      .map((item: any, index: number) => {
        const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Unknown date';
        return `${index + 1}. ${item.title || 'Untitled'} (${item.type})\n   📅 ${date}\n   🔗 ${item.url}\n   📝 ${item.description || 'No description'}`;
      })
      .join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `📂 Gallery (${media.length} items)\n\n${mediaList}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Alchemy Studio MCP Server running on stdio');
  }
}

// Start the server
const server = new AlchemyMCPServer();
server.run().catch(console.error);
