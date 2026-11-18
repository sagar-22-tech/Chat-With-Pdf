import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({
    apiKey: Deno.env.get("GEMINI_API_KEY"),
})
export async function embedChunks(chunks : string[]): Promise<number[][]>{
    const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents : chunks,
        config : {
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: 768,
        }
    })
    if(!response.embeddings){
        throw new Error("Gemini API did not return embeddings.")
    }
    return response.embeddings.map((item) => item.values ?? []);
}