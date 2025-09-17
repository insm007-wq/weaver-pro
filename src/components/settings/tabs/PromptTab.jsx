import React, { useState, useEffect, useRef } from "react";
import { Text, Button, Dropdown, Option, Field, Input, Textarea, Card, tokens, Divider } from "@fluentui/react-components";
import {
  AddRegular,
  DeleteRegular,
  SaveRegular,
  ArrowResetRegular,
  DocumentTextRegular,
  DismissCircleRegular,
  EditRegular,
  BrainCircuitRegular,
} from "@fluentui/react-icons";
import { useToast } from "../../../hooks/useToast";
import { useApi } from "../../../hooks/useApi";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { DEFAULT_GENERATE_PROMPT, DEFAULT_REFERENCE_PROMPT } from "../../../constants/prompts";

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
  const [isSaving, setIsSaving] = useState(false);

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
      const dScript = prompts.find((p) => p.isDefault && p.category === "script");
      const dRef = prompts.find((p) => p.isDefault && p.category === "reference");
      setScriptPrompt(dScript?.content?.trim() ?? catDefault("script"));
      setReferencePrompt(dRef?.content?.trim() ?? catDefault("reference"));

      const names = uniqueUserNames(prompts);
      if (names.length) {
        activatePair(names[0]);
      } else {
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
      setLoading(true);
      const res = await api.invoke("prompts:getAll");
      if (isOk(res) && Array.isArray(res.data)) {
        setPrompts(res.data.slice());
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  /* ============ pair load/save helpers ============ */
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

      if (!script && !reference && name === DEFAULT_PAIR_NAME) {
        setScriptPrompt(catDefault("script"));
        setReferencePrompt(catDefault("reference"));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const savePair = async (name, scriptText, referenceText) => {
    setIsSaving(true);
    const nm = (name || "").trim();
    if (!nm) throw new Error("name is empty");

    try {
      const res = await api.invoke("prompts:savePair", {
        name: nm,
        scriptContent: scriptText,
        referenceContent: referenceText,
      });
      if (!isOk(res)) throw new Error(res?.message || "save failed");

      const sId = res.data?.script?.id || "";
      const rId = res.data?.reference?.id || "";

      await loadPrompts();

      setSelectedName(nm);
      setSelectedScriptId(sId);
      setSelectedReferenceId(rId);

      setScriptPrompt(res.data?.script?.content ?? "");
      setReferencePrompt(res.data?.reference?.content ?? "");
      setIsSaving(false);
      return res;
    } catch (e) {
      setIsSaving(false);
      throw e;
    }
  };

  /* ============ dropdown options ============ */
  const nameOptions = React.useMemo(() => uniqueUserNames(prompts), [prompts]);

  /* ============ CRUD ============ */
  const handleCreateInline = async () => {
    const base = newName.trim();
    if (!base) return toast.warning("프롬프트 이름을 입력해주세요.");

    try {
      await savePair(base, catDefault("script"), catDefault("reference"));
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
        let suffix = 1;
        const baseName = "새 프롬프트";
        const exists = new Set(nameOptions);
        while (exists.has(suffix === 1 ? baseName : `${baseName} ${suffix}`)) suffix += 1;
        name = suffix === 1 ? baseName : `${baseName} ${suffix}`;
      }

      await savePair(name, scriptPrompt, referencePrompt);
      toast.success("성공적으로 저장되었습니다.");
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
        icon={<BrainCircuitRegular />}
        title="프롬프트 템플릿 관리"
        description="AI 대본 생성과 레퍼런스 분석에 사용할 프롬프트 템플릿을 관리합니다. 카테고리별로 프롬프트를 생성하고 편집하여 더 나은 결과를 얻으세요."
      />

      {/* ===== 상단 관리 바 (Dropdown과 액션 통합) ===== */}
      <Card
        className={cardStyles.settingsCard}
        style={{
          boxShadow: tokens.shadow8,
          borderRadius: 12,
          padding: tokens.spacingHorizontalXL,
          marginBottom: tokens.spacingVerticalL,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalM, flexWrap: "wrap" }}>
          {/* 프롬프트 선택 드롭다운 */}
          <div style={{ flex: "1 1 auto", minWidth: "200px" }}>
            <Field label="사용자 프롬프트 선택">
              <Dropdown
                selectedOptions={selectedName && nameOptions.includes(selectedName) ? [selectedName] : []}
                value={selectedName || (nameOptions[0] ?? "")}
                onOptionSelect={async (_, d) => {
                  const name = d?.optionValue;
                  if (name) await activatePair(name);
                }}
                placeholder="프롬프트를 선택하세요"
              >
                {nameOptions.map((nm) => (
                  <Option key={nm} value={nm}>
                    {nm}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>

          {/* 인라인 생성 UI */}
          {showInlineCreate && (
            <div
              style={{
                display: "flex",
                gap: tokens.spacingHorizontalS,
                alignItems: "flex-end",
                flex: "1 1 auto",
                minWidth: "200px",
              }}
            >
              <Field label="새 이름 입력" style={{ flex: 1 }}>
                <Input value={newName} onChange={(_, d) => setNewName(d.value)} placeholder="새 프롬프트 이름" autoFocus />
              </Field>
              <Button appearance="primary" icon={<SaveRegular />} onClick={handleCreateInline} disabled={!newName.trim()}>
                생성
              </Button>
              <Button
                appearance="subtle"
                icon={<DismissCircleRegular />}
                onClick={() => {
                  setShowInlineCreate(false);
                  setNewName("");
                }}
              >
                취소
              </Button>
            </div>
          )}

          {/* 관리 액션 버튼 */}
          <div
            style={{
              display: "flex",
              gap: tokens.spacingHorizontalS,
              alignItems: "flex-end",
              flexShrink: 0,
              flexGrow: 0,
            }}
          >
            <Button appearance="secondary" icon={<AddRegular />} onClick={() => setShowInlineCreate((v) => !v)}>
              새 프롬프트
            </Button>
            <Button
              appearance="secondary"
              icon={<DeleteRegular />}
              onClick={handleDelete}
              disabled={!selectedName || !nameOptions.includes(selectedName)}
            >
              삭제
            </Button>
            <Button
              appearance="primary"
              icon={isSaving ? <LoadingSpinner size="tiny" /> : <SaveRegular />}
              onClick={handleSaveAll}
              disabled={isSaving || !scriptPrompt || !referencePrompt}
            >
              저장하기
            </Button>
          </div>
        </div>
      </Card>

      {/* ===== 에디터 영역 (2단 그리드) ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: tokens.spacingHorizontalXL,
          height: "calc(100vh - 400px)", // 화면 높이에 맞춰 조정
        }}
      >
        {/* script */}
        <Card
          className={cardStyles.settingsCard}
          style={{
            boxShadow: tokens.shadow8, // 그림자 추가
            border: `1px solid ${tokens.colorNeutralStroke2}`, // 얇은 테두리
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: tokens.spacingVerticalM }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <EditRegular style={{ color: tokens.colorPaletteBlueForeground1 }} />
              <Text weight="semibold" size={500}>
                대본 생성 프롬프트
              </Text>
            </div>
            <Button size="small" icon={<ArrowResetRegular />} onClick={() => handleReset("script")}>
              기본값
            </Button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <Textarea
              value={scriptPrompt}
              onChange={(_, d) => setScriptPrompt(d.value)}
              resize="none"
              style={{
                height: "100%",
                width: "100%",
                fontSize: tokens.fontSizeBase300,
                fontFamily: "monospace",
                lineHeight: 1.6,
                border: "none",
                boxShadow: "none",
                background: "transparent",
                padding: 0,
              }}
            />
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalM }}>
            {scriptCount.toLocaleString()} 글자 | 변수: {"{topic}, {duration}, {style}"}
          </Text>
        </Card>

        {/* reference */}
        <Card
          className={cardStyles.settingsCard}
          style={{
            boxShadow: tokens.shadow8, // 그림자 추가
            border: `1px solid ${tokens.colorNeutralStroke2}`, // 얇은 테두리
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: tokens.spacingVerticalM }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <DocumentTextRegular style={{ color: tokens.colorPalettePurpleForeground1 }} />
              <Text weight="semibold" size={500}>
                레퍼런스 분석 프롬프트
              </Text>
            </div>
            <Button size="small" icon={<ArrowResetRegular />} onClick={() => handleReset("reference")}>
              기본값
            </Button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <Textarea
              value={referencePrompt}
              onChange={(_, d) => setReferencePrompt(d.value)}
              resize="none"
              style={{
                height: "100%",
                width: "100%",
                fontSize: tokens.fontSizeBase300,
                fontFamily: "monospace",
                lineHeight: 1.6,
                border: "none",
                boxShadow: "none",
                background: "transparent",
                padding: 0,
              }}
            />
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalM }}>
            {referenceCount.toLocaleString()} 글자 | 변수: {"{referenceScript}, {topic}"}
          </Text>
        </Card>
      </div>
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
