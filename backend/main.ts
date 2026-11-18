
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

// ---------------- CORS ----------------

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);


// ---------------- QDRANT HELPER ----------------

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

// ---------------- PDF TEXT EXTRACTION ----------------

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

// ---------------- PDF INGESTION ----------------

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

    // Extract text from PDF
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

    // Split text into chunks
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

    // Generate embeddings
    const vectors = await embedChunks(chunks);

    if (vectors.length !== chunks.length) {
      throw new Error("Embedding count does not match chunk count.");
    }

    // Create a unique document ID
    const docId = crypto.randomUUID();

    // Prepare Qdrant points
    const points = chunks.map((chunk, index) => ({
      id: crypto.randomUUID(),
      vector: vectors[index],
      payload: {
        text: chunk,
        docId,
        fileName: file.name,
      },
    }));

    // Store points directly through Qdrant REST API
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

// ---------------- CHAT WITH PDF ----------------

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

    // Parse conversation history
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

    // Generate embedding for the current question
    const [queryVector] = await embedChunks([question]);

    if (!queryVector) {
      throw new Error("Could not generate question embedding.");
    }

    // Search relevant PDF chunks using direct REST API
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

    // Safely access Qdrant response
    const points = searchResults?.result?.points ?? [];

    console.log("Retrieved PDF chunks:", points.length);

    // Extract relevant context
    const context = points
      .map((point: { payload?: { text?: unknown } | null }) => point.payload?.text)
      .filter((text: unknown): text is string =>
        typeof text === "string" && text.length > 0
      )
      .join("\n\n---\n\n");

    // Prepare conversation history
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

    // Build Gemini prompt
    const prompt = `
You are a helpful AI assistant that answers questions about an uploaded PDF.

Follow these instructions:
1. Answer using the provided PDF context whenever relevant.
2. Use the conversation history to understand follow-up questions.
3. Do not invent facts that are not supported by the PDF.
4. If the answer is not available in the PDF, clearly say so.
5. Give clear and easy-to-understand answers.
6. Avoid repeating unnecessary information.

PDF CONTEXT:
${context || "No relevant information was found in the PDF."}

CONVERSATION HISTORY:
${conversationHistory || "No previous conversation."}

CURRENT QUESTION:
${question}

ANSWER:
`;

    // Generate answer using Gemini
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

// ---------------- SERVER ----------------

Deno.serve(
  {
    port: PORT,
  },
  app.fetch,
);

console.log(`Listening on http://localhost:${PORT}/`);
