// src/components/tabs/ScriptPromptTab.jsx
import { useEffect, useState } from "react";
import { SelectField } from "../parts/SmallUI";
import { LLM_OPTIONS, TTS_ENGINES, VOICES_BY_ENGINE, DEFAULT_GENERATE_PROMPT } from "../constants";

// 간단 slugify
function slugify(name = "") {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

export default function ScriptPromptTab({
  template, // 현재 편집 문자열 (부모 state)
  setTemplate, // setState
  form, // 실행 설정 공유
  onChange, // (key, value) => void
  voices, // 현재 TTS 엔진의 보이스 목록
}) {
  // 프리셋 메타
  const [presets, setPresets] = useState([]); // [{id, name, updatedAt}]
  const [currentId, setCurrentId] = useState("default"); // 'default' | presetId
  const [savingAt, setSavingAt] = useState(null);

  // 새 프롬프트 UI
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const countTotal = 1 + (presets?.length || 0); // 기본 포함

  // ─────────────────────────────────────────────
  // 초기 로드: 선택 프리셋 + 본문 불러오기(없으면 기본값 주입)
  // settings keys:
  //   - prompt.generate.presets           : [{id,name,updatedAt}]
  //   - prompt.generate.current           : 'default' | presetId
  //   - prompt.generateTemplate           : 기본 프롬프트 본문
  //   - prompt.generate.preset.<id>       : 개별 프리셋 본문
  // ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const list = (await window?.api?.getSetting("prompt.generate.presets")) || [];
        setPresets(Array.isArray(list) ? list : []);

        const cur = (await window?.api?.getSetting("prompt.generate.current")) || "default";
        setCurrentId(cur);

        let body = "";
        if (cur === "default") {
          body = (await window?.api?.getSetting("prompt.generateTemplate")) || "";
        } else {
          body = (await window?.api?.getSetting(`prompt.generate.preset.${cur}`)) || "";
        }
        if (!body) body = DEFAULT_GENERATE_PROMPT; // 기본값 자동 주입
        setTemplate(body);
      } catch {
        setTemplate((prev) => prev || DEFAULT_GENERATE_PROMPT);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 프리셋 선택
  const handleSelect = async (id) => {
    try {
      setCurrentId(id);
      await window?.api?.setSetting({
        key: "prompt.generate.current",
        value: id,
      });

      let body = "";
      if (id === "default") {
        body = (await window?.api?.getSetting("prompt.generateTemplate")) || "";
      } else {
        body = (await window?.api?.getSetting(`prompt.generate.preset.${id}`)) || "";
      }
      if (!body) body = DEFAULT_GENERATE_PROMPT;
      setTemplate(body);
    } catch {
      setTemplate(DEFAULT_GENERATE_PROMPT);
    }
  };

  // 저장 (현재 선택한 대상에 저장)
  const handleSave = async () => {
    try {
      if (currentId === "default") {
        await window?.api?.setSetting({
          key: "prompt.generateTemplate",
          value: template,
        });
      } else {
        await window?.api?.setSetting({
          key: `prompt.generate.preset.${currentId}`,
          value: template,
        });
        const next = (presets || []).map((p) => (p.id === currentId ? { ...p, updatedAt: Date.now() } : p));
        setPresets(next);
        await window?.api?.setSetting({
          key: "prompt.generate.presets",
          value: next,
        });
      }
      await window?.api?.setSetting({
        key: "prompt.generate.current",
        value: currentId,
      });
      setSavingAt(new Date());
    } catch (e) {
      console.error(e);
    }
  };

  // 기본값으로 초기화 (에디터만 교체)
  const handleReset = () => {
    setTemplate(DEFAULT_GENERATE_PROMPT);
  };

  // 새 프롬프트 생성 (현재 에디터 내용을 초깃값으로 저장)
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = slugify(name);
    try {
      // 본문 저장
      await window?.api?.setSetting({
        key: `prompt.generate.preset.${id}`,
        value: template || DEFAULT_GENERATE_PROMPT,
      });
      // 목록 갱신(중복 id는 갱신)
      const next = [...(presets || []).filter((p) => p.id !== id), { id, name, updatedAt: Date.now() }];
      await window?.api?.setSetting({
        key: "prompt.generate.presets",
        value: next,
      });
      // 선택 전환
      await window?.api?.setSetting({
        key: "prompt.generate.current",
        value: id,
      });
      setPresets(next);
      setCurrentId(id);
      setCreating(false);
      setNewName("");
      // 저장된 본문을 다시 로드(보정)
      const body = (await window?.api?.getSetting(`prompt.generate.preset.${id}`)) || DEFAULT_GENERATE_PROMPT;
      setTemplate(body);
    } catch (e) {
      console.error(e);
    }
  };

  // 프롬프트 삭제 (기본 제외)
  const handleDelete = async () => {
    if (currentId === "default") return;
    try {
      // 스토어에서 본문 제거(선택적) — 없어도 무방
      await window?.api?.setSetting({
        key: `prompt.generate.preset.${currentId}`,
        value: "",
      });
      const next = (presets || []).filter((p) => p.id !== currentId);
      setPresets(next);
      await window?.api?.setSetting({
        key: "prompt.generate.presets",
        value: next,
      });
      // 기본으로 전환
      setCurrentId("default");
      await window?.api?.setSetting({
        key: "prompt.generate.current",
        value: "default",
      });
      const base = (await window?.api?.getSetting("prompt.generateTemplate")) || DEFAULT_GENERATE_PROMPT;
      setTemplate(base);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 프롬프트 관리 헤더 라인 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100">📝</span>
          <div className="text-sm font-semibold">프롬프트 관리</div>
          <span className="ml-1 text-xs text-slate-500">{countTotal}개</span>
        </div>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={currentId} onChange={(e) => handleSelect(e.target.value)}>
            <option value="default">기본 프롬프트 (기본)</option>
            {(presets || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button onClick={() => setCreating((v) => !v)} className="h-9 rounded-lg bg-blue-600 px-3 text-sm text-white hover:bg-blue-500">
            + 새 프롬프트
          </button>

          <button
            onClick={handleDelete}
            disabled={currentId === "default"}
            className={`h-9 rounded-lg px-3 text-sm ${
              currentId === "default" ? "bg-rose-100 text-rose-300 cursor-not-allowed" : "bg-rose-50 text-rose-600 hover:bg-rose-100"
            }`}
          >
            삭제
          </button>
        </div>
      </div>

      {/* 새 프롬프트 입력 박스 */}
      {creating && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">프롬프트 이름</label>
          <input
            autoFocus
            className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="새 프롬프트 이름을 입력하세요"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} className="flex-1 h-10 rounded-lg bg-blue-600 text-sm text-white hover:bg-blue-500">
              생성
            </button>
            <button onClick={() => setCreating(false)} className="flex-1 h-10 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 실행 옵션 (이전 디자인) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SelectField label="LLM (대본)" value={form.llmMain} options={LLM_OPTIONS} onChange={(v) => onChange("llmMain", v)} />
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

      {/* 에디터 (고정 높이 + 스크롤, 리사이즈 금지) */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">대본 프롬프트</div>
          <div className="text-[11px] text-slate-500">
            사용 변수: {"{topic}, {style}, {duration}, {maxScenes}, {minCharacters}, {maxCharacters}, {avgCharactersPerScene}"}
          </div>
        </div>
        <textarea
          className="w-full h-72 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 overflow-auto resize-none whitespace-pre-wrap"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        />
      </div>

      {/* 하단 액션 */}
      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
        <button onClick={handleReset} className="text-sm bg-slate-100 text-slate-700 rounded-lg px-4 py-2 hover:bg-slate-200">
          기본값으로 초기화
        </button>
        <button onClick={handleSave} className="text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-500">
          저장
        </button>
        {savingAt && <span className="ml-2 self-center text-[11px] text-slate-500">저장됨: {savingAt.toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
