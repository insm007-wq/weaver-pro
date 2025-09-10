import React, { useState, useEffect } from "react";
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Button,
  Dropdown,
  Option,
  Field,
  Input,
  Textarea,
  Card,
  Caption1,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular, SaveRegular, ArrowResetRegular, DocumentTextRegular } from "@fluentui/react-icons";
import { useToast } from "../../../hooks/useToast";
import { useApi } from "../../../hooks/useApi";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { SettingsHeader } from "../../common";

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalL),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
    maxWidth: "1200px",
    margin: "0 auto",
  },

  header: {
    textAlign: "center",
    marginBottom: tokens.spacingVerticalL,
  },
  headerTitle: {
    background: `linear-gradient(135deg, ${tokens.colorBrandForeground1} 0%, ${tokens.colorPaletteBlueForeground2} 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: "1.4",
    wordBreak: "keep-all",
  },
  headerDescription: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
    maxWidth: "600px",
    margin: "0 auto",
    lineHeight: "1.5",
  },

  settingsCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
  },

  /* ===== 프롬프트 관리 영역 (한 줄 스타일) ===== */
  manageCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
    marginBottom: tokens.spacingVerticalL,
  },
  manageRow: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  manageLabel: {
    fontWeight: tokens.fontWeightSemibold,
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalXS),
  },
  manageDropdown: {
    minWidth: "200px",
    flex: 1,
    maxWidth: "400px",
  },
  manageActions: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginLeft: "auto",
  },
  inlineCreate: {
    marginTop: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },

  /* ===== 기존 영역 유지 ===== */
  templateSection: { marginTop: tokens.spacingVerticalL },
  variableHelp: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM),
    marginTop: tokens.spacingVerticalS,
  },
  variableList: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginTop: tokens.spacingVerticalS,
  },
  variableTag: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS),
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
  },
  sectionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    ...shorthands.gap(tokens.spacingHorizontalL),
    marginTop: tokens.spacingVerticalL,
  },
  sectionCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalM,
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  editor: {
    minHeight: "200px",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
  },
  charCount: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    marginTop: tokens.spacingVerticalS,
  },
  editorField: {
    minHeight: "200px",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
  },
});

export default function PromptTab() {
  const styles = useStyles();
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
      <div className={styles.container}>
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
      <div className={styles.container}>
        <LoadingSpinner size="large" message="프롬프트를 로드하는 중..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={styles.container}>
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
        <Card className={styles.manageCard}>
          <div className={styles.manageRow}>
            <div className={styles.manageLabel}>
              <DocumentTextRegular />
              <Text weight="semibold">프롬프트</Text>
            </div>

            <Dropdown
              className={styles.manageDropdown}
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

            <div className={styles.manageActions}>
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
            <div className={styles.inlineCreate}>
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
        <Card className={styles.settingsCard}>
          {/* 프롬프트 에디터 섹션 */}
          <div className={styles.sectionsGrid}>
            {/* 대본 생성 섹션 */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
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
                  className={styles.editor}
                  value={scriptPrompt}
                  onChange={(_, data) => setScriptPrompt(data.value)}
                  disabled={loading}
                  resize="vertical"
                />
              </Field>
              <div className={styles.charCount}>
                {scriptCount.toLocaleString()} 글자 | 변수: {"{topic}, {duration}, {style}"}
              </div>
            </div>

            {/* 레퍼런스 분석 섹션 */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
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
                  className={styles.editor}
                  value={referencePrompt}
                  onChange={(_, data) => setReferencePrompt(data.value)}
                  disabled={loading}
                  resize="vertical"
                />
              </Field>
              <div className={styles.charCount}>
                {referenceCount.toLocaleString()} 글자 | 변수: {"{referenceScript}, {topic}"}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
