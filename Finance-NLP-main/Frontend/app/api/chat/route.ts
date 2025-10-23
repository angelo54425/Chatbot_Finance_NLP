import { type CoreMessage, StreamingTextResponse } from "ai"

export async function POST(req: Request) {
  const { messages }: { messages: CoreMessage[] } = await req.json()

  // Get the last user message
  const lastUserMessage = messages.filter((m) => m.role === "user").pop()

  if (!lastUserMessage) {
    return new Response("No user message found", { status: 400 })
  }

  const response = await fetch(process.env.CUSTOM_NLP_API_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: lastUserMessage.content,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  // Create a ReadableStream from the response
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data.response)
      controller.close()
    },
  })

  return new StreamingTextResponse(stream)
}

