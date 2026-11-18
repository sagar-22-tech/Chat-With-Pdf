export function chunkText(text : string, chunkSize : number = 1500, overlap : number = 225) :string[]{
    const cleanText = text.replace(/\s+/g, " ").trim()
    const chunks: string[] = []
    let start = 0;
    while(start < cleanText.length){
        const end = start + chunkSize
        chunks.push(cleanText.slice(start, end))
        start += chunkSize - overlap
    }
    return chunks;
}