import { useEffect, useState } from "react";
import { FaWifi, FaBan } from "react-icons/fa6"; // ✅ fa6에서 지원되는 아이콘 사용

function Dot({ state }) {
  const cls =
    state === "ok"
      ? "status-online"
      : state === "fail"
      ? "status-offline"
      : "status-pending";
  return <span className={`status-dot ${cls}`} />;
}

function Spinner() {
  return (
    <svg
      className="loading-spinner"
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
      className="group relative flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:border-primary-300 hover:bg-primary-25 cursor-default transition-all duration-200"
      title={r ? `${name}: ${r.state} (${String(r.detail)})` : `${name}: -`}
      onDoubleClick={onOpenSettings}
    >
      <Dot state={r?.state} />
      <span className="text-neutral-700 font-medium">{name}</span>
    </div>
  );

  return (
    <header className="nav-header h-14 flex items-center justify-end px-6">
      <div className="flex items-center gap-3">
        {/* 네트워크 상태 */}
        <div
          className="group relative flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:border-primary-300 hover:bg-primary-25 cursor-default transition-all duration-200"
          title={isOnline ? "온라인" : "오프라인"}
        >
          {isOnline ? (
            <FaWifi className="text-success-500" />
          ) : (
            <>
              <FaWifi className="text-error-500" />
              <FaBan className="absolute text-error-600" />
            </>
          )}
          <span className="text-neutral-700 font-medium">
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
          className="btn-primary min-w-[80px]"
          title="새로고침"
        >
          {loading ? <Spinner /> : "Refresh"}
        </button>
        <button
          onClick={onOpenSettings}
          className="btn-secondary"
          title="전역 설정"
        >
          Settings
        </button>
      </div>
    </header>
  );
}
