import React, { useState, useEffect } from "react";
import {
  Text,
  Button,
  Dropdown,
  Option,
  Field,
  Input,
  Textarea,
  Card,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular, SaveRegular, ArrowResetRegular, DocumentTextRegular } from "@fluentui/react-icons";
import { useToast } from "../../../hooks/useToast";
import { useApi } from "../../../hooks/useApi";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";


function PromptTab() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const toast = useToast();
  const api = useApi();

  // 프롬프트 상태 관리
  const [prompts, setPrompts] = useState([]);
  const [scriptPrompt, setScriptPrompt] = useState("");
  const [referencePrompt, setReferencePrompt] = useState("");
  const [loading, setLoading] = useState(true);

  // 선택된 프롬프트 ID
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [selectedReferenceId, setSelectedReferenceId] = useState("");

  // 관리 영역: 현재 관리 카테고리(script/reference) & 생성 폼
  const [mgrCategory, setMgrCategory] = useState("script"); // 내부 토글(UI엔 드러내지 않음)
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [newName, setNewName] = useState("");

  // API 가드
  if (!window.api) {
    return (
      <div className={containerStyles.container}>
        <Card>
          <div style={{ padding: tokens.spacingVerticalL, textAlign: "center" }}>
            <Text size={600}>⚠️</Text>
            <Text size={400} style={{ display: "block", marginTop: tokens.spacingVerticalM }}>
              Electron API가 로드되지 않았습니다.
            </Text>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3, display: "block", marginTop: tokens.spacingVerticalS }}>
              앱을 다시 시작해주세요.
            </Text>
          </div>
        </Card>
      </div>
    );
  }

  /* ================= 초기 로드 ================= */
  useEffect(() => {
    loadPrompts();
  }, []);

  useEffect(() => {
    const scriptDefault = prompts.find((p) => p.category === "script" && p.isDefault);
    const referenceDefault = prompts.find((p) => p.category === "reference" && p.isDefault);

    if (scriptDefault) {
      setSelectedScriptId(scriptDefault.id);
      setScriptPrompt(scriptDefault.content || "");
    }
    if (referenceDefault) {
      setSelectedReferenceId(referenceDefault.id);
      setReferencePrompt(referenceDefault.content || "");
    }
    setLoading(false);
  }, [prompts]);

  const loadPrompts = async () => {
    try {
      const result = await api.invoke("prompts:getAll");
      if (result?.ok && Array.isArray(result.data)) setPrompts(result.data);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  /* ================= CRUD ================= */
  const handleCreateInline = async () => {
    try {
      const payload = {
        name: newName.trim(),
        category: mgrCategory,
        content: "# 새 프롬프트\n\n여기에 프롬프트 내용을 입력하세요.",
      };
      if (!payload.name) {
        console.log("No name provided");
        return;
      }

      console.log("Creating prompt with payload:", payload);
      const result = await api.invoke("prompts:create", payload);
      console.log("Create result:", result);

      if (result?.ok) {
        // 새로 만든 항목의 ID 가져오기
        const created = result?.data?.id;

        // 프롬프트 목록을 다시 로드
        await loadPrompts();

        // 새로 만든 항목을 선택
        if (created) {
          const newContent = "# 새 프롬프트\n\n여기에 프롬프트 내용을 입력하세요.";
          if (mgrCategory === "script") {
            setSelectedScriptId(created);
            setScriptPrompt(newContent);
          } else if (mgrCategory === "reference") {
            setSelectedReferenceId(created);
            setReferencePrompt(newContent);
          }
        }

        // 인라인 생성 폼 닫기 및 초기화
        setShowInlineCreate(false);
        setNewName("");

        toast.success("프롬프트가 생성되었습니다.");
      } else {
        console.error("Create failed:", result);
        toast.error("프롬프트 생성에 실패했습니다.");
      }
    } catch (e) {
      console.error("Create error:", e);
      toast.error("프롬프트 생성에 실패했습니다.");
    }
  };

  const handleDelete = async () => {
    try {
      const targetId = mgrCategory === "script" ? selectedScriptId : selectedReferenceId;
      if (!targetId) return;

      // 백엔드에 prompts:delete가 없다면 무시되며 토스트만 표시됩니다.
      const result = await api.invoke?.("prompts:delete", targetId);
      if (result?.ok) {
        await loadPrompts();
        if (mgrCategory === "script") {
          setSelectedScriptId("");
          setScriptPrompt("");
        } else {
          setSelectedReferenceId("");
          setReferencePrompt("");
        }
        toast.success("삭제되었습니다.");
      } else {
        toast.warning("삭제 API가 없거나 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      toast.error("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleSave = async (category, content) => {
    try {
      const promptId = category === "script" ? selectedScriptId : selectedReferenceId;
      if (!promptId) return;

      const result = await api.invoke("prompts:update", promptId, { content });
      if (result?.ok) {
        await loadPrompts();
        toast.success("프롬프트가 저장되었습니다.");
      }
    } catch (e) {
      console.error(e);
      toast.error("저장에 실패했습니다.");
    }
  };

  const handleSaveAll = async () => {
    if (selectedScriptId && scriptPrompt) await handleSave("script", scriptPrompt);
    if (selectedReferenceId && referencePrompt) await handleSave("reference", referencePrompt);
  };

  const handleReset = async (category) => {
    try {
      const result = await api.invoke("prompts:getDefault", category);
      if (result?.ok && result.data) {
        if (category === "script") {
          setScriptPrompt(result.data.content || "");
          setSelectedScriptId(result.data.id);
        } else {
          setReferencePrompt(result.data.content || "");
          setSelectedReferenceId(result.data.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  /* ================= 드롭다운/선택 ================= */
  const scriptList = prompts.filter((p) => p.category === "script");
  const referenceList = prompts.filter((p) => p.category === "reference");

  const currentList = mgrCategory === "script" ? scriptList : referenceList;
  const currentSelectedId = mgrCategory === "script" ? selectedScriptId : selectedReferenceId;

  const onSelectPrompt = (_, data) => {
    const id = data.optionValue;
    if (mgrCategory === "script") {
      setSelectedScriptId(id);
      const picked = scriptList.find((p) => p.id === id);
      if (picked) setScriptPrompt(picked.content || "");
    } else {
      setSelectedReferenceId(id);
      const picked = referenceList.find((p) => p.id === id);
      if (picked) setReferencePrompt(picked.content || "");
    }
  };

  const scriptCount = scriptPrompt ? scriptPrompt.length : 0;
  const referenceCount = referencePrompt ? referencePrompt.length : 0;

  if (loading) {
    return (
      <div className={containerStyles.container}>
        <LoadingSpinner size="large" message="프롬프트를 로드하는 중..." />
      </div>
    );
  }

  return (
    <div className={containerStyles.container}>
        {/* Header (그대로) */}
        <SettingsHeader
          icon="🧠"
          title="프롬프트 템플릿 관리"
          description={
            <>
              AI 대본 생성과 레퍼런스 분석에 사용할 프롬프트 템플릿을 관리합니다.
              <br />카테고리별로 프롬프트를 생성하고 편집하여 더 나은 결과를 얻으세요.
            </>
          }
        />

        {/* ===== 프롬프트 관리 (한 줄 컴팩트) ===== */}
        <Card className={settingsStyles.manageCard}>
          <div className={settingsStyles.manageRow}>
            <div className={settingsStyles.manageLabel}>
              <DocumentTextRegular />
              <Text weight="semibold">프롬프트</Text>
            </div>

            <Dropdown
              className={settingsStyles.manageDropdown}
              value={
                currentList.find((p) => p.id === currentSelectedId)?.name ||
                (mgrCategory === "script" ? "대본 생성 선택" : "레퍼런스 분석 선택")
              }
              selectedOptions={[currentSelectedId]}
              onOptionSelect={onSelectPrompt}
              placeholder="프롬프트를 선택하세요"
            >
              {currentList.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}
                </Option>
              ))}
            </Dropdown>

            <div className={settingsStyles.manageActions}>
              <Button
                icon={<AddRegular />}
                appearance="primary"
                size="small"
                onClick={() => {
                  setMgrCategory("script");
                  setShowInlineCreate(!showInlineCreate);
                }}
              >
                새 프롬프트
              </Button>
              <Button appearance="secondary" icon={<DeleteRegular />} size="small" onClick={handleDelete} disabled={!currentSelectedId}>
                삭제
              </Button>
              <Button appearance="primary" icon={<SaveRegular />} size="small" onClick={handleSaveAll} disabled={loading}>
                모두 저장
              </Button>
            </div>
          </div>

          {/* 인라인 생성 박스 (접이식) */}
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

        {/* ===== 프롬프트 에디터 영역 ===== */}
        <Card className={cardStyles.settingsCard}>
          {/* 프롬프트 에디터 섹션 */}
          <div className={settingsStyles.sectionsGrid}>
            {/* 대본 생성 섹션 */}
            <div className={settingsStyles.sectionCard}>
              <div className={settingsStyles.sectionHeader}>
                <div className={settingsStyles.sectionTitle}>
                  <Text weight="semibold" size={500}>
                    📝 대본 생성
                  </Text>
                </div>
                <div>
                  <Button size="small" icon={<ArrowResetRegular />} onClick={() => handleReset("script")} disabled={loading}>
                    초기화
                  </Button>
                </div>
              </div>

              <Field>
                <Textarea
                  className={settingsStyles.editor}
                  value={scriptPrompt}
                  onChange={(_, data) => setScriptPrompt(data.value)}
                  disabled={loading}
                  resize="vertical"
                />
              </Field>
              <div className={settingsStyles.charCount}>
                {scriptCount.toLocaleString()} 글자 | 변수: {"{topic}, {duration}, {style}"}
              </div>
            </div>

            {/* 레퍼런스 분석 섹션 */}
            <div className={settingsStyles.sectionCard}>
              <div className={settingsStyles.sectionHeader}>
                <div className={settingsStyles.sectionTitle}>
                  <Text weight="semibold" size={500}>
                    🔍 레퍼런스 분석
                  </Text>
                </div>
                <div>
                  <Button size="small" icon={<ArrowResetRegular />} onClick={() => handleReset("reference")} disabled={loading}>
                    초기화
                  </Button>
                </div>
              </div>

              <Field>
                <Textarea
                  className={settingsStyles.editor}
                  value={referencePrompt}
                  onChange={(_, data) => setReferencePrompt(data.value)}
                  disabled={loading}
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
