
import { useEffect, useRef, useState } from "react";

const API_BASE_URL =import.meta.env.VITE_API_URL

const Main = ({
  pdf,
  setPdf,
  chats,
  setChats,
  sessionId,
  setSessionId,
  userChats,
  setUserChats,
  pendingFile,
  clearPendingFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [input, setInput] = useState("");
  const [docId, setDocId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Refs for the currently active session.
  const activeDocIdRef = useRef(null);
  const messagesRef = useRef(chats ?? []);
  const sessionIdRef = useRef(sessionId);

  const uploadInProgressRef = useRef(false);
  const askingRef = useRef(false);

  // Keep the session ref synchronized with the selected session.
  sessionIdRef.current = sessionId;

  const getCurrentTime = () =>
    new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

  // Save or update a session using consistent field names.
  const syncSessionHistory = (
    currentId,
    fileName,
    time,
    messages,
    currentDocId
  ) => {
    setUserChats((prevSessions = []) => {
      const sessionData = {
        id: currentId,
        name: fileName,
        docId: currentDocId,
        time,
        chats: messages,
      };

      const sessionIndex = prevSessions.findIndex(
        (session) =>
          String(session.id) === String(currentId)
      );

      if (sessionIndex !== -1) {
        const updated = [...prevSessions];
        updated[sessionIndex] = {
          ...updated[sessionIndex],
          ...sessionData,
        };

        return updated;
      }

      return [sessionData, ...prevSessions];
    });
  };

  // Upload a PDF and create a completely separate session.
  const startNewSession = async (file) => {
    if (!file) return;

    if (
      uploadInProgressRef.current ||
      askingRef.current
    ) {
      alert("Please wait for the current operation to finish.");
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      alert("Only PDF files are supported.");
      return;
    }

    uploadInProgressRef.current = true;
    setIsUploading(true);
    setUploadError("");

    const newSessionId = crypto.randomUUID();
    const uploadTime = getCurrentTime();

    // Immediately isolate the new session from the previous one.
    sessionIdRef.current = newSessionId;
    activeDocIdRef.current = null;
    messagesRef.current = [];

    setSessionId(newSessionId);
    setPdf(file);
    setChats([]);
    setDocId(null);
    setInput("");

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 120000);

    try {
      console.log(
        "[PDF upload] Starting:",
        file.name,
        file.size,
        "bytes"
      );

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}/ingest`,
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        }
      );

      console.log(
        "[PDF upload] HTTP status:",
        response.status
      );

      const responseText = await response.text();

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Backend returned a non-JSON response: ${responseText.slice(0, 300)}`
        );
      }

      console.log("[PDF upload] Backend response:", data);

      if (
        !response.ok ||
        data.status !== "ok" ||
        !data.docId
      ) {
        throw new Error(
          data.message ||
            `PDF upload failed (HTTP ${response.status}).`
        );
      }

      // Store the document ID returned by the backend.
      activeDocIdRef.current = data.docId;
      setDocId(data.docId);

      // Save this PDF as its own chat session.
      syncSessionHistory(
        newSessionId,
        file.name,
        uploadTime,
        [],
        data.docId
      );

      console.log("[PDF upload] Ready:", {
        sessionId: newSessionId,
        docId: data.docId,
        fileName: file.name,
        chunksStored: data.chunksStored,
      });
    } catch (error) {
      const message =
        error.name === "AbortError"
          ? "PDF processing timed out after 2 minutes. Check the backend terminal."
          : error.message || "Unknown upload error.";

      console.error("[PDF upload] Failed:", error);

      setUploadError(message);

      activeDocIdRef.current = null;
      messagesRef.current = [];

      setPdf(null);
      setChats([]);
      setDocId(null);
      setSessionId(null);
      sessionIdRef.current = null;
    } finally {
      clearTimeout(timeoutId);

      uploadInProgressRef.current = false;
      setIsUploading(false);
    }
  };

  // Handle PDFs selected from the Sidebar.
  useEffect(() => {
    if (!pendingFile) return;

    startNewSession(pendingFile);
    clearPendingFile?.();
  }, [pendingFile]);

  // Handle file selection from the main upload screen.
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    // Allow selecting the same file again.
    e.target.value = "";

    if (file) {
      startNewSession(file);
    }
  };

  // Restore the selected session's PDF ID and messages.
  useEffect(() => {
    if (!sessionId) {
      activeDocIdRef.current = null;
      messagesRef.current = [];

      setDocId(null);
      setChats([]);
      setPdf(null);

      return;
    }

    const selectedSession = userChats?.find(
      (session) =>
        String(session.id) === String(sessionId)
    );

    // A new upload may not have been saved yet.
    if (!selectedSession) return;

    activeDocIdRef.current =
      selectedSession.docId || null;

    messagesRef.current =
      selectedSession.chats || [];

    setDocId(selectedSession.docId || null);
    setChats(selectedSession.chats || []);

    setPdf(
      selectedSession.name
        ? {
            name: selectedSession.name,
            isRestored: true,
          }
        : null
    );

    setInput("");
    setUploadError("");
  }, [sessionId, userChats]);

  // Send a question using only the active session's PDF.
  const handleSubmit = async (e) => {
    e.preventDefault();

    const currentDocId = activeDocIdRef.current;
    const currentSessionId = sessionIdRef.current;
    const currentPdf = pdf;

    if (!currentPdf || !currentDocId || !currentSessionId) {
      alert(
        "Please upload a PDF and wait until its status is Ready."
      );
      return;
    }

    if (
      askingRef.current ||
      uploadInProgressRef.current ||
      !input.trim()
    ) {
      return;
    }

    askingRef.current = true;
    setIsAsking(true);

    const questionText = input.trim();
    const currentTime = getCurrentTime();

    const userMessage = {
      sender: "user",
      text: questionText,
      time: currentTime,
    };

    const updatedHistory = [
      ...(messagesRef.current ?? []),
      userMessage,
    ];

    messagesRef.current = updatedHistory;

    setChats(updatedHistory);
    setInput("");

    syncSessionHistory(
      currentSessionId,
      currentPdf.name,
      currentTime,
      updatedHistory,
      currentDocId
    );

    try {
      const formData = new FormData();

      formData.append("docId", currentDocId);
      formData.append("question", questionText);
      formData.append(
        "history",
        JSON.stringify(updatedHistory)
      );

      console.log(
        "[Chat] Sending question for docId:",
        currentDocId
      );

      const response = await fetch(
        `${API_BASE_URL}/ask`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || data.status !== "ok") {
        throw new Error(
          data.message ||
            `Question request failed (HTTP ${response.status}).`
        );
      }

      const aiReply = {
        sender: "ai",
        text: data.answer,
        time: getCurrentTime(),
      };

      const finalHistory = [
        ...updatedHistory,
        aiReply,
      ];

      // Always save the reply to the session that asked it.
      syncSessionHistory(
        currentSessionId,
        currentPdf.name,
        aiReply.time,
        finalHistory,
        currentDocId
      );

      // Update the visible chat only if it is still selected.
      if (
        String(sessionIdRef.current) ===
        String(currentSessionId)
      ) {
        messagesRef.current = finalHistory;
        setChats(finalHistory);
      }
    } catch (error) {
      console.error("[Chat] Request failed:", error);

      const errorReply = {
        sender: "ai",
        text: `Error: ${error.message}`,
        time: getCurrentTime(),
      };

      const finalHistory = [
        ...updatedHistory,
        errorReply,
      ];

      syncSessionHistory(
        currentSessionId,
        currentPdf.name,
        errorReply.time,
        finalHistory,
        currentDocId
      );

      if (
        String(sessionIdRef.current) ===
        String(currentSessionId)
      ) {
        messagesRef.current = finalHistory;
        setChats(finalHistory);
      }
    } finally {
      askingRef.current = false;
      setIsAsking(false);
    }
  };

  // Drag and drop handlers.
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];

    if (file) {
      startNewSession(file);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-h-screen bg-black px-4">
      {!pdf ? (
        // PDF UPLOAD SCREEN
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
          <div className="heading text-center max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-sans text-white">
              Chat with{" "}
              <span className="text-slate-300">
                your PDF
              </span>
            </h1>

            <p className="mt-4 text-lg md:text-xl text-slate-300">
              Upload a document and ask questions, get instant answers
            </p>
          </div>

          <div className="w-full max-w-2xl mx-auto p-4">
            <label
              htmlFor="pdf-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full py-10 px-6 bg-neutral-950 border border-dashed rounded-3xl cursor-pointer transition ${
                isDragging
                  ? "border-white bg-neutral-900"
                  : "border-neutral-500 hover:border-white hover:bg-neutral-900/50"
              }`}
            >
              <svg
                className="w-12 h-12 text-white mb-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>

              <p className="text-white text-lg font-medium">
                Drag & drop your PDF here
              </p>

              <div className="flex items-center gap-3 my-3 w-40">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-neutral-600" />

                <span className="text-neutral-400 text-sm">
                  or
                </span>

                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-neutral-600" />
              </div>

              <span className="inline-flex items-center gap-2.5 bg-white text-black font-semibold text-base px-7 py-3 rounded-full hover:bg-neutral-200 transition">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>

                Browse Files
              </span>

              <p className="text-neutral-300 text-sm mt-4">
                Supports PDF files only
              </p>

              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                disabled={isUploading || isAsking}
                className="hidden"
              />
            </label>

            {uploadError && (
              <p className="mt-4 text-sm text-red-400 text-center">
                {uploadError}
              </p>
            )}
          </div>
        </div>
      ) : (
        // CHAT SCREEN
        <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto py-6">
          {/* DOCUMENT HEADER */}
          <div className="flex items-center justify-between bg-neutral-900/70 border border-neutral-800 rounded-2xl px-4 py-3 mb-4">
            <span className="text-sm text-neutral-200 truncate">
              📄{" "}
              <strong className="text-white">
                {pdf.name}
              </strong>
            </span>

            <span className="text-xs text-neutral-400">
              {isUploading
                ? "Uploading and indexing..."
                : docId
                ? "Ready"
                : "Waiting for upload..."}
            </span>
          </div>

          {uploadError && (
            <p className="mb-3 text-sm text-red-400">
              {uploadError}
            </p>
          )}

          {/* CHAT MESSAGES */}
          {chats.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
              {isUploading
                ? "Extracting text, generating embeddings and storing your PDF..."
                : docId
                ? "Ask a question below to start chatting with your document."
                : "Waiting for the PDF to finish processing..."}
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-4">
              {chats.map((msg, idx) => (
                <div
                  key={idx}
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-white text-black self-end"
                      : "bg-neutral-900 text-neutral-200 self-start border border-neutral-800"
                  }`}
                >
                  <p>{msg.text}</p>

                  <span className="block text-[10px] opacity-60 mt-1">
                    {msg.time}
                  </span>
                </div>
              ))}

              {/* THINKING ANIMATION */}
              {isAsking && (
                <div className="flex items-center gap-3 self-start bg-neutral-900 border border-neutral-800 rounded-2xl px-5 py-3">
                  <span className="text-sm text-neutral-400">
                    Thinking
                  </span>

                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MESSAGE INPUT */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-2xl px-4 py-2 mt-4"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isUploading || isAsking || !docId}
              placeholder={
                isUploading
                  ? "Uploading PDF..."
                  : `Ask anything about ${pdf.name}...`
              }
              className="flex-1 bg-transparent text-white placeholder-neutral-400 text-base focus:outline-none disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={
                isUploading ||
                isAsking ||
                !docId ||
                !input.trim()
              }
              className="flex items-center justify-center w-11 h-11 bg-white text-black rounded-full hover:bg-neutral-200 transition shrink-0 disabled:opacity-50"
              title="Send message"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h14m-7-7l7 7-7 7"
                />
              </svg>
            </button>
          </form>
        </div>
      )}
    </main>
  );
};

export default Main;
