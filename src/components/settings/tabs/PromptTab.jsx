import React, { useState, useEffect, useRef } from "react";
import { Text, Button, Dropdown, Option, Field, Input, Textarea, Card } from "@fluentui/react-components";
import { AddRegular, DeleteRegular, SaveRegular, ArrowResetRegular, DocumentTextRegular } from "@fluentui/react-icons";
import { useToast } from "../../../hooks/useToast";
import { useApi } from "../../../hooks/useApi";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { DEFAULT_GENERATE_PROMPT, DEFAULT_REFERENCE_PROMPT } from "../../scriptgen/constants";

/* ================= helpers ================= */
const isOk = (res) => res?.ok === true || res?.success === true;
const catDefault = (cat) => (cat === "script" ? DEFAULT_GENERATE_PROMPT : DEFAULT_REFERENCE_PROMPT);
const DEFAULT_PAIR_NAME = "기본프롬프트(기본)";

const uniqueUserNames = (list) =>
  Array.from(new Set(list.filter((p) => !p.isDefault).map((p) => p.name)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ko"));

/* ================= component ================= */
function PromptTab() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const toast = useToast();
  const api = useApi();

  // store snapshot
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);

  // editor states
  const [scriptPrompt, setScriptPrompt] = useState("");
  const [referencePrompt, setReferencePrompt] = useState("");

  // selection
  const [selectedName, setSelectedName] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [selectedReferenceId, setSelectedReferenceId] = useState("");

  // UI helpers
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const didInitRef = useRef(false);

  /* ============ init load ============ */
  useEffect(() => {
    loadPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didInitRef.current && Array.isArray(prompts)) {
      // 에디터 초기값은 "최초 1회"만 시스템 기본으로 채움
      const dScript = prompts.find((p) => p.isDefault && p.category === "script");
      const dRef = prompts.find((p) => p.isDefault && p.category === "reference");
      setScriptPrompt(dScript?.content?.trim() ?? catDefault("script"));
      setReferencePrompt(dRef?.content?.trim() ?? catDefault("reference"));

      const names = uniqueUserNames(prompts);
      if (names.length) {
        // 첫 진입: 사용자 프롬프트가 있으면 그 첫 번째로 로딩
        activatePair(names[0]);
      } else {
        // 없으면 "기본쌍" 상태(저장 전까지는 기본값만 화면에 표시)
        setSelectedName(DEFAULT_PAIR_NAME);
        setSelectedScriptId("");
        setSelectedReferenceId("");
      }
      didInitRef.current = true;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts]);

  const loadPrompts = async () => {
    try {
      const res = await api.invoke("prompts:getAll");
      if (isOk(res) && Array.isArray(res.data)) setPrompts(res.data.slice());
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  /* ============ pair load/save helpers ============ */
  // 이름으로 script/reference 함께 불러오기 (저장된 항목만 에디터에 반영)
  const activatePair = async (name) => {
    try {
      setSelectedName(name);
      const res = await api.invoke("prompts:getPairByName", name);
      if (!isOk(res)) throw new Error(res?.message || "load failed");

      const { script, reference } = res.data || {};

      setSelectedScriptId(script?.id || "");
      setSelectedReferenceId(reference?.id || "");

      if (script) setScriptPrompt(script.content?.trim() ?? "");
      if (reference) setReferencePrompt(reference.content?.trim() ?? "");

      // 둘 다 없고 "기본쌍"을 선택한 경우만 기본값 주입
      if (!script && !reference && name === DEFAULT_PAIR_NAME) {
        setScriptPrompt(catDefault("script"));
        setReferencePrompt(catDefault("reference"));
      }
    } catch (e) {
      console.error(e);
      // 실패해도 현재 에디터 텍스트는 유지 (덮어쓰지 않음)
    }
  };

  // 원자적 저장: 두 카테고리 동시 저장 → 저장된 항목으로 즉시 재로딩
  const savePair = async (name, scriptText, referenceText) => {
    const nm = (name || "").trim();
    if (!nm) throw new Error("name is empty");

    const res = await api.invoke("prompts:savePair", {
      name: nm,
      scriptContent: scriptText,
      referenceContent: referenceText,
    });
    if (!isOk(res)) throw new Error(res?.message || "save failed");

    // 저장 직후 정확히 그 결과로 재로딩
    const sId = res.data?.script?.id || "";
    const rId = res.data?.reference?.id || "";

    // 스토어 스냅샷 갱신
    await loadPrompts();

    // 방금 저장된 내용으로 고정
    setSelectedName(nm);
    setSelectedScriptId(sId);
    setSelectedReferenceId(rId);

    // 화면 텍스트는 서버가 가진 결과에 맞춰 확정
    if (res.data?.script) setScriptPrompt(res.data.script.content ?? "");
    if (res.data?.reference) setReferencePrompt(res.data.reference.content ?? "");
  };

  /* ============ dropdown options ============ */
  const nameOptions = React.useMemo(() => uniqueUserNames(prompts), [prompts]);

  /* ============ CRUD ============ */
  const handleCreateInline = async () => {
    const base = newName.trim();
    if (!base) return toast.warning("프롬프트 이름을 입력해주세요.");

    const nm = base; // 중복 이름 체크는 백엔드가 (name,category) 기준으로 정리/업서트
    try {
      // 요구사항: 새로 생성 시 두 탭 모두 기본값으로 생성 & 에디터 채움
      await savePair(nm, catDefault("script"), catDefault("reference"));
      setShowInlineCreate(false);
      setNewName("");
      toast.success("프롬프트가 생성되었습니다.");
    } catch (e) {
      console.error(e);
      toast.error("프롬프트 생성에 실패했습니다.");
    }
  };

  const handleDelete = async () => {
    try {
      if (!selectedName || selectedName === DEFAULT_PAIR_NAME) {
        return toast.warning("삭제할 사용자 프롬프트가 없습니다.");
      }
      const res = await api.invoke("prompts:deleteByName", selectedName);
      if (!isOk(res)) return toast.error(res?.message || "삭제 실패");

      await loadPrompts();
      const remaining = uniqueUserNames((await api.invoke("prompts:getAll"))?.data || []);
      if (remaining.length) await activatePair(remaining[0]);
      else {
        setSelectedName(DEFAULT_PAIR_NAME);
        setSelectedScriptId("");
        setSelectedReferenceId("");
        setScriptPrompt(catDefault("script"));
        setReferencePrompt(catDefault("reference"));
      }
      toast.success("삭제되었습니다.");
    } catch (e) {
      console.error(e);
      toast.error("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleSaveAll = async () => {
    try {
      let name = selectedName;
      if (!name || name === DEFAULT_PAIR_NAME) {
        // 기본쌍 상태에서 저장하면, 현재 텍스트로 새 이름 저장 요구 → 간단히 자동 이름
        name = "새 프롬프트";
        let suffix = 1;
        const exists = new Set(nameOptions);
        while (exists.has(suffix === 1 ? name : `${name} ${suffix}`)) suffix += 1;
        name = suffix === 1 ? name : `${name} ${suffix}`;
      }

      await savePair(name, scriptPrompt, referencePrompt);
      toast.success("대본/레퍼런스 모두 저장 완료");
    } catch (e) {
      console.error(e);
      toast.error("저장 중 오류가 발생했습니다.");
    }
  };

  const handleReset = (category) => {
    if (category === "script") setScriptPrompt(catDefault("script"));
    else setReferencePrompt(catDefault("reference"));
    toast.success("프롬프트가 기본값으로 초기화되었습니다.");
  };

  /* ============ render ============ */
  const scriptCount = scriptPrompt.length || 0;
  const referenceCount = referencePrompt.length || 0;

  if (loading) {
    return (
      <div className={containerStyles.container}>
        <LoadingSpinner size="large" message="프롬프트를 로드하는 중..." />
      </div>
    );
  }

  return (
    <div className={containerStyles.container}>
      <SettingsHeader
        icon="🧠"
        title="프롬프트 템플릿 관리"
        description={
          <>
            AI 대본 생성과 레퍼런스 분석에 사용할 프롬프트 템플릿을 관리합니다.
            <br />
            카테고리별로 프롬프트를 생성하고 편집하여 더 나은 결과를 얻으세요.
          </>
        }
      />

      {/* ===== 상단 관리 바 (UI 그대로) ===== */}
      <Card className={settingsStyles.manageCard}>
        <div className={settingsStyles.manageRow}>
          <div className={settingsStyles.manageLabel}>
            <DocumentTextRegular />
            <Text weight="semibold">프롬프트</Text>
          </div>

          <Dropdown
            className={settingsStyles.manageDropdown}
            selectedOptions={selectedName && nameOptions.includes(selectedName) ? [selectedName] : []}
            value={selectedName || (nameOptions[0] ?? "")}
            onOptionSelect={async (_, d) => {
              const name = d?.optionValue;
              if (name) await activatePair(name);
            }}
          >
            {nameOptions.map((nm) => (
              <Option key={nm} value={nm}>
                {nm}
              </Option>
            ))}
          </Dropdown>

          <div className={settingsStyles.manageActions}>
            <Button icon={<AddRegular />} appearance="primary" size="small" onClick={() => setShowInlineCreate((v) => !v)}>
              새 프롬프트
            </Button>
            <Button
              appearance="secondary"
              icon={<DeleteRegular />}
              size="small"
              onClick={handleDelete}
              disabled={!selectedName || !nameOptions.includes(selectedName)}
            >
              삭제
            </Button>
            <Button appearance="primary" icon={<SaveRegular />} size="small" onClick={handleSaveAll}>
              모두 저장
            </Button>
          </div>
        </div>

        {showInlineCreate && (
          <div className={settingsStyles.inlineCreate}>
            <Input value={newName} onChange={(_, d) => setNewName(d.value)} placeholder="새 프롬프트 이름을 입력하세요" autoFocus />
            <Button appearance="primary" icon={<SaveRegular />} onClick={handleCreateInline} disabled={!newName.trim()}>
              생성
            </Button>
            <Button
              appearance="secondary"
              onClick={() => {
                setShowInlineCreate(false);
                setNewName("");
              }}
            >
              취소
            </Button>
          </div>
        )}
      </Card>

      {/* ===== 에디터 영역 (UI 그대로) ===== */}
      <Card className={cardStyles.settingsCard}>
        <div className={settingsStyles.sectionsGrid}>
          {/* script */}
          <div className={settingsStyles.sectionCard}>
            <div className={settingsStyles.sectionHeader}>
              <div className={settingsStyles.sectionTitle}>
                <Text weight="semibold" size={500}>
                  📝 대본 생성
                </Text>
              </div>
              <div>
                <Button size="small" icon={<ArrowResetRegular />} onClick={() => handleReset("script")}>
                  초기화
                </Button>
              </div>
            </div>

            <Field>
              <Textarea
                className={settingsStyles.editor}
                value={scriptPrompt}
                onChange={(_, d) => setScriptPrompt(d.value)}
                resize="vertical"
              />
            </Field>
            <div className={settingsStyles.charCount}>
              {scriptCount.toLocaleString()} 글자 | 변수: {"{topic}, {duration}, {style}"}
            </div>
          </div>

          {/* reference */}
          <div className={settingsStyles.sectionCard}>
            <div className={settingsStyles.sectionHeader}>
              <div className={settingsStyles.sectionTitle}>
                <Text weight="semibold" size={500}>
                  🔍 레퍼런스 분석
                </Text>
              </div>
              <div>
                <Button size="small" icon={<ArrowResetRegular />} onClick={() => handleReset("reference")}>
                  초기화
                </Button>
              </div>
            </div>

            <Field>
              <Textarea
                className={settingsStyles.editor}
                value={referencePrompt}
                onChange={(_, d) => setReferencePrompt(d.value)}
                resize="vertical"
              />
            </Field>
            <div className={settingsStyles.charCount}>
              {referenceCount.toLocaleString()} 글자 | 변수: {"{referenceScript}, {topic}"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function PromptTabWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <PromptTab />
    </ErrorBoundary>
  );
}
