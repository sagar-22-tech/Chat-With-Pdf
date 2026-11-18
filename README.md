# Chat with PDF – AI-Powered Document Question Answering System

An AI-powered application that allows users to upload PDF documents and ask questions about their content using natural language. The application uses **Retrieval-Augmented Generation (RAG)** to retrieve relevant information from uploaded documents and generate context-aware answers using Google Gemini.

## 🚀 Features

- **PDF Upload:** Upload PDF documents through a simple and user-friendly interface.
- **Text Extraction:** Extract text from PDF files using PDF.js.
- **Text Chunking:** Divide extracted text into smaller chunks for efficient processing and retrieval.
- **Semantic Search:** Generate embeddings and store them in Qdrant Vector Database.
- **AI-Powered Answers:** Use Google Gemini to generate answers based on relevant document content.
- **Document-Based Retrieval:** Retrieve information only from the selected document.
- **Multiple Chat Sessions:** Create and manage separate conversations for different PDF documents.
- **Chat History:** Save conversations in browser local storage so users can revisit previous sessions.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend user interface |
| Deno | Backend runtime |
| Hono | Backend web framework |
| Google Gemini 2.5 Flash | AI-generated responses |
| Qdrant Cloud | Vector database |
| PDF.js | PDF text extraction |
| REST APIs | Frontend-backend communication |
| RAG | Document-based question answering |

## 🧠 How It Works

The application follows a Retrieval-Augmented Generation (RAG) approach.

### 1. PDF Upload
The user uploads a PDF document through the React frontend. The file is sent to the backend using a multipart form request.

### 2. Text Extraction
The backend uses PDF.js to extract text from the uploaded PDF.

### 3. Text Chunking
The extracted text is divided into smaller chunks so that relevant information can be retrieved efficiently.

### 4. Embedding Generation
Embeddings are generated for the text chunks and stored in the Qdrant vector database along with their document IDs.

### 5. Question Processing
When the user asks a question, the backend generates an embedding for that question.

### 6. Semantic Search
Qdrant searches for the most relevant text chunks based on semantic similarity. The search is filtered using the selected document ID to avoid retrieving information from other documents.

### 7. Answer Generation
The retrieved chunks and user's question are passed to Google Gemini 2.5 Flash, which generates a context-aware response.

### 8. Display Response
The generated answer is returned to the React frontend and displayed in the chat interface.

## 🏗️ Project Architecture

```text
                 USER
                   |
                   v
             React Frontend
                   |
                   v
             Deno + Hono API
                   |
          +--------+--------+
          |                 |
          v                 v
      PDF Upload        User Question
          |                 |
          v                 v
      PDF.js          Question Embedding
          |
          v
     Text Extraction
          |
          v
      Text Chunking
          |
          v
    Embedding Generation
          |
          v
     Qdrant Vector DB
          |
          v
   Relevant Chunk Retrieval
          |
          v
    Google Gemini 2.5 Flash
          |
          v
      Generated Answer
          |
          v
      React Frontend
```

## 🔌 API Endpoints

### 1. Ingest PDF

**Endpoint:** `POST /ingest`

Uploads a PDF, extracts its text, creates chunks, generates embeddings, and stores them in Qdrant.

**Request:** Multipart form data containing the PDF file.

**Response:**

```json
{
  "docId": "document-id",
  "chunksStored": 25,
  "status": "ok"
}
```

### 2. Ask a Question

**Endpoint:** `POST /ask`

Accepts a question and retrieves relevant information from the selected PDF to generate an answer.

**Request:** Multipart form data containing:

- `docId`: Selected document ID
- `question`: User's question
- `history`: Previous conversation messages in JSON format

**Response:**

```json
{
  "answer": "The generated answer based on the PDF content.",
  "sourcesCount": 3,
  "status": "ok"
}
```

## ⚙️ Installation and Setup

### Prerequisites

Make sure you have installed:

- Node.js and npm
- Deno
- A Qdrant Cloud account
- A Google Gemini API key

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd <project-folder>
```

### 2. Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

### 3. Backend Setup

Navigate to the backend directory and install or configure the required dependencies.

Configure your environment variables for:

- Google Gemini API key
- Qdrant Cloud URL
- Qdrant API key

Start the Deno backend using the run command configured in your project.

### 4. Run the Application

Start both frontend and backend servers. Open the frontend URL in your browser and upload a PDF to start asking questions.

## 🔐 Environment Configuration

Keep API keys and database credentials in environment variables. Do not commit secret keys to the repository.

Example configuration (use the variable names expected by your backend):

```env
GEMINI_API_KEY=your_gemini_api_key
QDRANT_URL=your_qdrant_cloud_url
QDRANT_API_KEY=your_qdrant_api_key
```

## 🎯 Future Improvements

- Support for multiple file formats such as DOCX and TXT.
- Display source references for generated answers.
- Streaming AI responses.
- User authentication and cloud-based chat history.
- Improved document management and search functionality.

## 👨‍💻 Project Objective

The main objective of this project is to make information retrieval from PDF documents easier and faster. Instead of manually searching through lengthy documents, users can simply ask questions and receive relevant answers using AI and semantic search.

---

**Built using React.js, Deno, Hono, Qdrant, PDF.js, and Google Gemini 2.5 Flash.**