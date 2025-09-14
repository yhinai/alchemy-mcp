/**
 * 👋 Welcome to your Smithery project!
 * To run your server, run "npm run dev"
 *
 * You might find these resources useful:
 *
 * 🧑‍💻 MCP's TypeScript SDK (helps you define your server)
 * https://github.com/modelcontextprotocol/typescript-sdk
 *
 * 📝 smithery.yaml (defines user-level config, like settings or API keys)
 * https://smithery.ai/docs/build/project-config/smithery-yaml
 *
 * 💻 smithery CLI (run "npx @smithery/cli dev" or explore other commands below)
 * https://smithery.ai/docs/concepts/cli
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

// Optional: If you have user-level config, define it here
// This should map to the config in your smithery.yaml file
export const configSchema = z.object({
	debug: z.boolean().default(false).describe("Enable debug logging"),
	geminiApiKey: z.string().describe("Gemini API Key"),
	openaiApiKey: z.string().optional().describe("OpenAI API Key (optional)"),
	baseUrl: z.string().default("http://localhost:3000").describe("Base URL for the frontend app"),
})

export default function createServer({
	config,
}: {
	config: z.infer<typeof configSchema> // Define your config in smithery.yaml
}) {
	const ai = new GoogleGenerativeAI(config.geminiApiKey)
	const openai = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null
	const baseUrl = config.baseUrl

	const server = new McpServer({
		name: "alchemy-studio",
		version: "1.0.0",
	})

	// Generate image tool
	server.registerTool(
		"generate_image",
		{
			title: "Generate Image",
			description: "Generate an image using Imagen 4 or Gemini 2.5 Flash",
			inputSchema: {
				prompt: z.string().describe("Image description"),
				model: z.enum(["imagen", "gemini"]).default("gemini").describe("Model to use"),
				aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).default("16:9").describe("Aspect ratio"),
			},
		},
		async ({ prompt, model = "gemini", aspect_ratio = "16:9" }) => {
			try {
				if (!prompt) throw new Error('Missing prompt')

				if (model === 'imagen') {
					// Fallback to Gemini image-preview since direct Imagen via this SDK is not supported
					const modelId = 'gemini-2.5-flash-image-preview'
					const modelInstance: any = (ai as any).getGenerativeModel({ model: modelId })
					const result = await modelInstance.generateContent({
						contents: [{ role: 'user', parts: [{ text: prompt }] }]
					})

					const parts = result?.response?.candidates?.[0]?.content?.parts || []
					let inlineData: any = null
					for (const p of parts) {
						if (p?.inlineData?.data) { inlineData = p.inlineData; break }
					}
					if (!inlineData?.data) throw new Error('No image generated')
					const dataUrl = `data:${inlineData.mimeType || 'image/png'};base64,${inlineData.data}`
					return { content: [{ type: 'text', text: `✅ Image (Gemini fallback for Imagen)\n\nPrompt: ${prompt}\n\n${dataUrl}` }] }
				}

				// Gemini image generation (image preview model emits inline data)
				const modelId = 'gemini-2.5-flash-image-preview'
				const modelInstance: any = (ai as any).getGenerativeModel({ model: modelId })
				const result = await modelInstance.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })

				const parts = result?.response?.candidates?.[0]?.content?.parts || []
				let inlineData: any = null
				for (const p of parts) {
					if (p?.inlineData?.data) { inlineData = p.inlineData; break }
				}
				if (!inlineData?.data) throw new Error('No image generated')
				const dataUrl = `data:${inlineData.mimeType || 'image/png'};base64,${inlineData.data}`
				return { content: [{ type: 'text', text: `✅ Gemini image\n\nPrompt: ${prompt}\n\n${dataUrl}` }] }
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` }] }
			}
		},
	)

	// Edit image tool
	server.registerTool(
		"edit_image",
		{
			title: "Edit Image",
			description: "Edit an existing image using AI",
			inputSchema: {
				prompt: z.string().describe("Edit instructions"),
				image_url: z.string().describe("Image URL or base64 data URL"),
			},
		},
		async ({ prompt, image_url }) => {
			try {
				if (!prompt || !image_url) throw new Error('Missing prompt or image_url')

				// Normalize to base64 PNG
				let base64Data: string
				let mimeType = 'image/png'
				if (String(image_url).startsWith('data:')) {
					const [header, b64] = String(image_url).split(',')
					base64Data = b64
					const m = header.match(/data:([^;]+)/)
					if (m?.[1]) mimeType = m[1]
				} else {
					const res = await fetch(String(image_url))
					if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
					const buff = Buffer.from(await res.arrayBuffer())
					base64Data = buff.toString('base64')
				}

				const modelId = 'gemini-2.5-flash-image-preview'
				const modelInstance: any = (ai as any).getGenerativeModel({ model: modelId })
				const result = await modelInstance.generateContent({
					contents: [
						{ role: 'user', parts: [ { text: prompt }, { inlineData: { mimeType, data: base64Data } } ] }
					]
				})

				const parts = result?.response?.candidates?.[0]?.content?.parts || []
				let inlineData: any = null
				for (const p of parts) {
					if (p?.inlineData?.data) { inlineData = p.inlineData; break }
				}
				if (!inlineData?.data) throw new Error('No edited image returned')

				const dataUrl = `data:${inlineData.mimeType || 'image/png'};base64,${inlineData.data}`
				return { content: [{ type: 'text', text: `✅ Edited image\n\nInstructions: ${prompt}\n\n${dataUrl}` }] }
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` }] }
			}
		},
	)

	// Cultural insights tool
	server.registerTool(
		"get_cultural_insights",
		{
			title: "Get Cultural Insights",
			description: "Get cultural intelligence for a location using OpenAI",
			inputSchema: {
				city: z.string().describe("City name"),
				country: z.string().describe("Country name"),
				business_type: z.string().optional().describe("Type of business"),
				target_audience: z.string().optional().describe("Target audience"),
			},
		},
		async ({ city, country, business_type, target_audience }) => {
			try {
				if (!city || !country) throw new Error('Missing city or country')
				if (!openai) throw new Error('OpenAI API key not configured')

				const sys = `You are a cultural intelligence assistant. Return concise, practical insights for marketing/creative.
Fields: profile, aesthetics, communication, themes.
Keep each field under ~6 bullet points. No markdown code fences.`
				const prompt = `City: ${city}\nCountry: ${country}\nBusiness: ${business_type || 'n/a'}\nAudience: ${target_audience || 'general'}\nProvide cultural insights with fields: profile, aesthetics, communication, themes.`
				const resp = await openai.chat.completions.create({
					model: 'gpt-4o-mini',
					messages: [
						{ role: 'system', content: sys },
						{ role: 'user', content: prompt }
					],
					temperature: 0.3,
					max_tokens: 700
				})
				const text = resp.choices?.[0]?.message?.content || 'No insights generated'
				return { content: [{ type: 'text', text }] }
			} catch (error: any) {
				return { content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` }] }
			}
		},
	)


	return server.server
}
