
import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { chunkText } from "./services/chunk.ts";
import { embedChunks } from "./services/embedding.ts";
import { GoogleGenAI } from "@google/genai/node";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const app = new Hono();

const PORT = 8000;
const COLLECTION_NAME = "pdf-collection";

const QDRANT_URL = Deno.env.get("QDRANT_URL")!.replace(/\/+$/, "");
const QDRANT_API_KEY = Deno.env.get("QDRANT_API_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// CORS

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);


// QDRANT HELPER

async function qdrantRequest(
  endpoint: string,
  options: RequestInit = {},
) {
  const response = await fetch(`${QDRANT_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "api-key": QDRANT_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Qdrant API error (${response.status}): ${errorText}`,
    );
  }

  return await response.json();
}

// PDF TEXT EXTRACTION

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  const pdf = await getDocument({
    data: new Uint8Array(buffer),

  }).promise;

  let extractedText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    extractedText += `\n${pageText}`;
  }

  return extractedText.trim();
}

//HEALTH CHECKPOINT
app.get("/health", (c) => (c.json({
  message: "Server is working",
  status: 200
})))

// PDF UPLOADING

app.post("/ingest", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return c.json(
        {
          message: "Please upload a valid PDF file.",
          status: "error",
        },
        400,
      );
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return c.json(
        {
          message: "Only PDF files are supported.",
          status: "error",
        },
        400,
      );
    }

    console.log("Processing PDF:", file.name);

    
    const extractedText = await extractPdfText(file);

    if (!extractedText) {
      return c.json(
        {
          message: "No readable text found in the PDF.",
          status: "error",
        },
        400,
      );
    }

    
    const chunks = chunkText(extractedText);

    if (!chunks.length) {
      return c.json(
        {
          message: "No text chunks were generated.",
          status: "error",
        },
        400,
      );
    }

    
    const vectors = await embedChunks(chunks);

    if (vectors.length !== chunks.length) {
      throw new Error("Embedding count does not match chunk count.");
    }

   
    const docId = crypto.randomUUID();

    
    const points = chunks.map((chunk, index) => ({
      id: crypto.randomUUID(),
      vector: vectors[index],
      payload: {
        text: chunk,
        docId,
        fileName: file.name,
      },
    }));

    
    await qdrantRequest(
      `/collections/${COLLECTION_NAME}/points?wait=true`,
      {
        method: "PUT",
        body: JSON.stringify({
          points,
        }),
      },
    );

    console.log("PDF ingestion successful:", docId);

    return c.json({
      docId,
      chunksStored: points.length,
      status: "ok",
    });
  } catch (error) {
    console.error("PDF ingestion error:", error);

    return c.json(
      {
        message: error instanceof Error
          ? error.message
          : "PDF ingestion failed.",
        status: "error",
      },
      500,
    );
  }
});

// CHAT WITH PDF

app.post("/ask", async (c) => {
  try {
    const formData = await c.req.formData();

    const docId = formData.get("docId");
    const question = formData.get("question");
    const historyString = formData.get("history");

    if (
      typeof docId !== "string" ||
      typeof question !== "string" ||
      !question.trim()
    ) {
      return c.json(
        {
          message: "Document ID and question are required.",
          status: "error",
        },
        400,
      );
    }

    
    let history: Array<{ sender: string; text: string }> = [];

    if (typeof historyString === "string") {
      try {
        const parsedHistory = JSON.parse(historyString);

        if (Array.isArray(parsedHistory)) {
          history = parsedHistory;
        }
      } catch {
        console.warn("Invalid conversation history received.");
      }
    }

    
    const [queryVector] = await embedChunks([question]);

    if (!queryVector) {
      throw new Error("Could not generate question embedding.");
    }

   
    const searchResults = await qdrantRequest(
      `/collections/${COLLECTION_NAME}/points/query`,
      {
        method: "POST",
        body: JSON.stringify({
          query: queryVector,
          limit: 4,
          with_payload: true,
          filter: {
            must: [
              {
                key: "docId",
                match: {
                  value: docId,
                },
              },
            ],
          },
        }),
      },
    );

   
    const points = searchResults?.result?.points ?? [];

    console.log("Retrieved PDF chunks:", points.length);

    
    const context = points
      .map((point: { payload?: { text?: unknown } | null }) => point.payload?.text)
      .filter((text: unknown): text is string =>
        typeof text === "string" && text.length > 0
      )
      .join("\n\n---\n\n");

    
    const conversationHistory = history
      .filter(
        (message) =>
          message &&
          typeof message.text === "string" &&
          (message.sender === "user" || message.sender === "ai"),
      )
      .slice(-10)
      .map((message) => {
        const role = message.sender === "user"
          ? "User"
          : "Assistant";

        return `${role}: ${message.text}`;
      })
      .join("\n");

    
    
const prompt = `
You are Chatify, an AI-powered PDF assistant developed by Sagar.

Your job is to help users understand their uploaded PDF documents and also answer general questions about Chatify itself.

Follow these instructions:

1. Identify whether the user's question is related to the uploaded PDF or is a general question about Chatify.
2. For PDF-related questions, use the provided PDF context whenever relevant.
3. Use conversation history to understand follow-up questions.
4. Never invent facts or provide unsupported information from the PDF.
5. If the answer to a PDF-related question is not available in the document, clearly say so.
6. Give clear, friendly, and easy-to-understand answers.
7. Avoid repeating unnecessary information.

GENERAL QUESTIONS ABOUT CHATIFY:

If the user asks questions such as:
- What can you do?
- Who developed you?
- Who created Chatify?
- What is Chatify?
- What technologies are used in Chatify?
- How does Chatify work?
- What is your purpose?
- Are you an AI assistant?
- Questions about your features or development.

Answer these questions using the following information instead of relying on PDF context.

ABOUT CHATIFY:
- Name: Chatify
- Developer: Sagar
- Type: AI-powered PDF Question Answering Application
- Technology: Retrieval-Augmented Generation (RAG)
- Frontend: React.js
- Backend: Deno and Hono
- AI Model: Google Gemini 2.5 Flash
- Vector Database: Qdrant Cloud
- PDF Text Extraction: PDF.js

WHAT CAN YOU DO?
- Help users understand uploaded PDF documents.
- Answer questions based on PDF content.
- Find relevant information using semantic search.
- Understand follow-up questions using conversation history.
- Generate easy-to-understand answers.
- Maintain separate chat sessions for different PDF documents.

HOW DO YOU WORK?
1. Extract text from uploaded PDF documents.
2. Divide the extracted text into smaller chunks.
3. Generate embeddings for the chunks.
4. Store embeddings in Qdrant Vector Database.
5. Retrieve relevant chunks when a user asks a question.
6. Send the retrieved context to Google Gemini.
7. Generate an answer based on the retrieved information.

RESPONSE RULES FOR GENERAL QUESTIONS:
- If asked who developed you, reply: "I was developed by Sagar as a project to make understanding PDF documents easier using AI."
- If asked what you can do, briefly explain your PDF question-answering capabilities.
- If asked about your technologies, mention the actual technology stack listed above.
- Be friendly and conversational.
- Do not pretend to be a human.
- Do not claim features that are not listed above.
- Do not use PDF context to answer questions about your developer or your own features.

PDF CONTEXT:
${context || "No relevant information was found in the PDF."}

CONVERSATION HISTORY:
${conversationHistory || "No previous conversation."}

CURRENT QUESTION:
${question}

ANSWER:
`;


    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
    });

    const answer = response.text;

    if (!answer) {
      throw new Error("Gemini returned an empty response.");
    }
    

    return c.json({
      answer,
      sourcesCount: points.length,
      status: "ok",
    });
  } catch (error) {
    console.error("Question answering error:", error);

    return c.json(
      {
        message: error instanceof Error
          ? error.message
          : "Question answering failed.",
        status: "error",
      },
      500,
    );
  }
});

// SERVER

Deno.serve(
  {
    port: PORT,
  },
  app.fetch,
);


