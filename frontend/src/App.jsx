
import { useState, useEffect } from "react";
import "./App.css";
import Main from "./Layouts/Main";
import Sidebar from "./Layouts/Sidebar";

function App() {
  const [pdf, setPdf] = useState(null);
  const [chats, setChats] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  // Load saved chat sessions.
  const [userChats, setUserChats] = useState(() => {
    try {
      const saved = localStorage.getItem("userChats");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Error loading saved chats:", error);
      return [];
    }
  });

  // Save chat sessions whenever they change.
  useEffect(() => {
    localStorage.setItem("userChats", JSON.stringify(userChats));
  }, [userChats]);

  // Select and restore an existing chat.
  const handleSelectChat = (session) => {
    if (!session) return;

    setSessionId(session.id);
    setChats(session.chats || []);

    setPdf(
      session.name
        ? {
            name: session.name,
            isRestored: true,
          }
        : null
    );

    // Do not upload the PDF again.
    setPendingFile(null);
  };

  // Start a fresh chat without uploading directly here.
  const handleUploadFile = (file) => {
    if (!file) return;

    setPendingFile(file);
  };

  return (
    <div className="flex min-h-screen bg-black">

      {/* Sidebar */}
      <Sidebar
        pdf={pdf}
        userChats={userChats}
        activeSessionId={sessionId}
        onSelectChat={handleSelectChat}
        onUploadFile={handleUploadFile}
      />

      {/* Main Chat */}
      <Main
        pdf={pdf}
        setPdf={setPdf}
        chats={chats}
        setChats={setChats}
        sessionId={sessionId}
        setSessionId={setSessionId}
        userChats={userChats}
        setUserChats={setUserChats}
        pendingFile={pendingFile}
        clearPendingFile={() => setPendingFile(null)}
      />

    </div>
  );
}

export default App;
