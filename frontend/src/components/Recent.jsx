
const Recent = ({
  userChats = [],
  activeSessionId,
  onSelectChat,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-2 mb-2">
        Recent Chats
      </p>

      <ul className="flex-1 overflow-y-auto space-y-1 pr-1">
        {userChats.length === 0 ? (
          <li className="px-2 py-2 text-xs text-neutral-500">
            No recent chats
          </li>
        ) : (
          userChats.map((item) => {
            const isActive =
              String(item.id) === String(activeSessionId);

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectChat(item)}
                  className={`w-full text-left flex flex-col px-2.5 py-2 rounded-xl border cursor-pointer transition-colors ${
                    isActive
                      ? "border-white bg-neutral-800 text-white"
                      : "border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:bg-neutral-800/60 hover:text-white"
                  }`}
                >
                  <span
                    className="text-sm font-medium truncate w-full"
                    title={item.name}
                  >
                    {item.name || "Untitled Chat"}
                  </span>

                  <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-0.5">
                    <span>{item.time || ""}</span>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};

export default Recent;
