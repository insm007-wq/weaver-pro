import { useEffect, useState } from "react";
import { FaWifi, FaBan } from "react-icons/fa6"; // ✅ fa6에서 지원되는 아이콘 사용

function Dot({ state }) {
  const cls =
    state === "ok"
      ? "bg-emerald-500"
      : state === "fail"
      ? "bg-rose-500"
      : "bg-gray-400";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function HeaderBar({ onOpenSettings }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await window.api.healthCheck();
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const h = () => refresh();
    window.addEventListener("health:refresh", h);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("health:refresh", h);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const Item = ({ name, r }) => (
    <div
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-gray-100 cursor-default"
      title={r ? `${name}: ${r.state} (${String(r.detail)})` : `${name}: -`}
      onDoubleClick={onOpenSettings}
    >
      <Dot state={r?.state} />
      <span className="text-gray-700">{name}</span>
    </div>
  );

  return (
    <header className="h-12 flex items-center justify-end px-4 border-b bg-white">
      <div className="flex items-center gap-2">
        {/* 네트워크 상태 */}
        <div
          className="relative flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-gray-100 cursor-default"
          title={isOnline ? "온라인" : "오프라인"}
        >
          {isOnline ? (
            <FaWifi className="text-emerald-500" />
          ) : (
            <>
              <FaWifi className="text-rose-500" />
              <FaBan className="absolute text-rose-600" />
            </>
          )}
          <span className="text-gray-700">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>

        {/* API 상태 */}
        <Item name="Anthropic" r={data?.anthropic} />
        <Item name="Replicate" r={data?.replicate} />
        <Item name="MiniMax" r={data?.minimax} />

        {/* 버튼 */}
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center justify-center text-xs px-2 py-1 rounded bg-gray-900 text-white hover:bg-black disabled:opacity-60"
          title="새로고침"
        >
          {loading ? <Spinner /> : "Refresh"}
        </button>
        <button
          onClick={onOpenSettings}
          className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
          title="전역 설정"
        >
          Settings
        </button>
      </div>
    </header>
  );
}
