// src/components/tabs/ReferencePromptTab.jsx
import { useEffect, useState } from "react";
import { SelectField } from "../parts/SmallUI";
import {
  LLM_OPTIONS,
  TTS_ENGINES,
  VOICES_BY_ENGINE,
  DEFAULT_REFERENCE_PROMPT,
} from "../constants";

// 간단 slugify
function slugify(name = "") {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

export default function ReferencePromptTab({
  template,
  setTemplate,
  form,
  onChange,
  voices,
  onRun, // 공통 실행(단축키용)
  refText, // 레퍼런스 원문
  setRefText,
  savedAt, // 저장 시각(부모)
  onSave,
  onReset,
}) {
  // 프리셋 메타
  const [presets, setPresets] = useState([]);
  const [currentId, setCurrentId] = useState("default");
  const [savingAt, setSavingAt] = useState(null);

  // 새 프롬프트 UI
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const countTotal = 1 + (presets?.length || 0);

  // 초기 로드: 프리셋 목록/현재 id만
  useEffect(() => {
    (async () => {
      try {
        const list =
          (await window?.api?.getSetting("prompt.reference.presets")) || [];
        setPresets(Array.isArray(list) ? list : []);
        const cur =
          (await window?.api?.getSetting("prompt.reference.current")) ||
          "default";
        setCurrentId(cur);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Ctrl/Cmd + Enter → 상단 공통 실행
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (typeof onRun === "function") {
          e.preventDefault();
          onRun();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onRun]);

  // 프리셋 선택 시 본문 로드
  const handleSelect = async (id) => {
    try {
      setCurrentId(id);
      await window?.api?.setSetting({
        key: "prompt.reference.current",
        value: id,
      });

      let body = "";
      if (id === "default") {
        body =
          (await window?.api?.getSetting("prompt.referenceTemplate")) || "";
      } else {
        body =
          (await window?.api?.getSetting(`prompt.reference.preset.${id}`)) ||
          "";
      }
      if (!body) body = DEFAULT_REFERENCE_PROMPT;
      setTemplate(body);
    } catch {
      setTemplate(DEFAULT_REFERENCE_PROMPT);
    }
  };

  // 저장
  const handleSave = async () => {
    try {
      if (currentId === "default") {
        if (typeof onSave === "function") {
          await onSave();
        } else {
          await window?.api?.setSetting({
            key: "prompt.referenceTemplate",
            value: template,
          });
        }
      } else {
        await window?.api?.setSetting({
          key: `prompt.reference.preset.${currentId}`,
          value: template,
        });
        const next = (presets || []).map((p) =>
          p.id === currentId ? { ...p, updatedAt: Date.now() } : p
        );
        setPresets(next);
        await window?.api?.setSetting({
          key: "prompt.reference.presets",
          value: next,
        });
      }
      await window?.api?.setSetting({
        key: "prompt.reference.current",
        value: currentId,
      });
      setSavingAt(new Date());
    } catch (e) {
      console.error(e);
    }
  };

  // 기본값으로 초기화
  const handleReset = () => {
    if (typeof onReset === "function") onReset();
    else setTemplate(DEFAULT_REFERENCE_PROMPT);
  };

  // 새 프리셋 생성
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    try {
      await window?.api?.setSetting({
        key: `prompt.reference.preset.${id}`,
        value: template || DEFAULT_REFERENCE_PROMPT,
      });
      const next = [
        ...(presets || []).filter((p) => p.id !== id),
        { id, name, updatedAt: Date.now() },
      ];
      await window?.api?.setSetting({
        key: "prompt.reference.presets",
        value: next,
      });
      await window?.api?.setSetting({
        key: "prompt.reference.current",
        value: id,
      });

      setPresets(next);
      setCurrentId(id);
      setCreating(false);
      setNewName("");

      const body =
        (await window?.api?.getSetting(`prompt.reference.preset.${id}`)) ||
        DEFAULT_REFERENCE_PROMPT;
      setTemplate(body);
    } catch (e) {
      console.error(e);
    }
  };

  // 프리셋 삭제 (기본 제외)
  const handleDelete = async () => {
    if (currentId === "default") return;
    try {
      await window?.api?.setSetting({
        key: `prompt.reference.preset.${currentId}`,
        value: "",
      });
      const next = (presets || []).filter((p) => p.id !== currentId);
      setPresets(next);
      await window?.api?.setSetting({
        key: "prompt.reference.presets",
        value: next,
      });

      setCurrentId("default");
      await window?.api?.setSetting({
        key: "prompt.reference.current",
        value: "default",
      });

      const base =
        (await window?.api?.getSetting("prompt.referenceTemplate")) ||
        DEFAULT_REFERENCE_PROMPT;
      setTemplate(base);
    } catch (e) {
      console.error(e);
    }
  };

  const savedLabel = savedAt || savingAt;
  const refLen = (refText || "").length;

  return (
    <div className="flex flex-col gap-4">
      {/* 프롬프트 관리 헤더 라인 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100">
            📑
          </span>
          <div className="text-sm font-semibold text-neutral-900">레퍼런스 프롬프트 관리</div>
          <span className="ml-1 text-xs text-neutral-600">{countTotal}개</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
            value={currentId}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="default">기본 프롬프트 (기본)</option>
            {(presets || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="btn-primary h-9"
          >
            + 새 프롬프트
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={currentId === "default"}
            className={`h-9 rounded-lg px-3 text-sm font-medium transition-all duration-200 ${
              currentId === "default"
                ? "bg-error-100 text-error-300 cursor-not-allowed"
                : "bg-error-50 text-error-600 hover:bg-error-100 border border-error-200"
            }`}
          >
            삭제
          </button>
        </div>
      </div>

      {/* ⬇️ 새 프롬프트 입력 박스 (헤더 바로 아래, 스크립트 탭과 동일 위치) */}
      {creating && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            프롬프트 이름
          </label>
          <input
            autoFocus
            className="input-field h-11"
            placeholder="새 프롬프트 이름을 입력하세요"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="flex-1 h-10 rounded-lg bg-blue-600 text-sm text-white hover:bg-blue-500"
            >
              생성
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="flex-1 h-10 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 실행 옵션 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SelectField
          label="LLM (대본)"
          value={form.llmMain}
          options={LLM_OPTIONS}
          onChange={(v) => onChange("llmMain", v)}
        />
        <SelectField
          label="TTS 엔진"
          value={form.ttsEngine}
          options={TTS_ENGINES}
          onChange={(v) => {
            onChange("ttsEngine", v);
            const vs = VOICES_BY_ENGINE[v] || [];
            if (vs.length) onChange("voiceName", vs[0]);
          }}
        />
        <SelectField
          label="보이스"
          value={form.voiceName}
          options={(voices || []).map((v) => ({ label: v, value: v }))}
          onChange={(v) => onChange("voiceName", v)}
        />
      </div>

      {/* 레퍼런스 대본 입력란 */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">
            레퍼런스 대본 (분석할 원문)
          </div>
          <div className="text-[11px] text-slate-500">
            글자수: {refText?.length?.toLocaleString?.() || 0}
          </div>
        </div>
        <textarea
          className="w-full h-48 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 overflow-auto resize-none whitespace-pre-wrap"
          placeholder="여기에 분석할 레퍼런스 대본을 붙여넣으세요"
          value={refText}
          onChange={(e) => setRefText(e.target.value)}
        />
      </div>

      {/* 프롬프트 에디터 */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">레퍼런스 프롬프트</div>
          <div className="text-[11px] text-slate-500">
            (실행: Ctrl/Cmd + Enter · 상단 ‘실행’ 버튼 사용)
          </div>
        </div>
        <textarea
          className="w-full h-72 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 overflow-auto resize-none whitespace-pre-wrap"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        />
      </div>

      {/* 하단 액션: 저장/초기화 + 저장시각(오른쪽) */}
      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleReset}
          className="text-sm bg-slate-100 text-slate-700 rounded-lg px-4 py-2 hover:bg-slate-200"
        >
          기본값으로 초기화
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-500"
        >
          저장
        </button>
        {savedLabel && (
          <span className="ml-2 self-center text-[11px] text-slate-500">
            저장됨: {new Date(savedLabel).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
