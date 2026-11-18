import { useState } from "react";
import Recent from "../components/Recent";

const Sidebar = ({
  pdf,
  userChats,
  activeSessionId,
  onSelectChat,
  onUploadFile,
  mobileOpen = false,
  onClose = () => {},
}) => {
  const [isDragging, setIsDragging] = useState(false);

  // Validate and send the selected PDF to Main.jsx.
  const handleFile = (file) => {
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      alert("Only PDF files are supported.");
      return;
    }

    if (typeof onUploadFile === "function") {
      onUploadFile(file);
      onClose();
    }
  };

  // Browse files handler.
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    handleFile(file);

    // Allow selecting the same file again.
    e.target.value = "";
  };

  // Drag and drop handlers.
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-[100dvh] w-[min(82vw,18rem)]
          shrink-0 flex-col gap-6 overflow-y-auto
          border-r border-neutral-800 bg-black p-5
          transition-transform duration-300
          md:sticky md:top-0 md:z-20 md:h-[100dvh]
          md:w-64 md:translate-x-0
          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }
        `}
      >
        {/* Logo */}
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight font-sans text-white">
              Chat <span className="text-slate-300">PDF</span>
            </h1>

            {/* Close button for mobile */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white md:hidden"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  d="M6 6l12 12M18 6L6 18"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Upload PDF */}
        <div>
          <label
            htmlFor="sidebar-pdf-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              flex items-center justify-center gap-2
              w-full min-h-12 py-3 px-4
              rounded-full font-semibold text-sm
              cursor-pointer transition
              ${
                isDragging
                  ? "bg-neutral-800 text-white border border-dashed border-white"
                  : "bg-white text-black hover:bg-neutral-200"
              }
            `}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>

            <span>
              {pdf ? "Upload New PDF" : "Upload PDF"}
            </span>

            <input
              id="sidebar-pdf-upload"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Recent Chats */}
        <Recent
          userChats={userChats}
          activeSessionId={activeSessionId}
          onSelectChat={onSelectChat}
        />

        {/* Active Document */}
        {pdf && (
          <div className="mt-auto bg-neutral-900/70 border border-neutral-800 rounded-xl p-3">
            <p className="text-xs text-neutral-400 mb-1">
              Active Document
            </p>

            <p className="text-sm text-white font-medium truncate">
              📄 {pdf.name}
            </p>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;