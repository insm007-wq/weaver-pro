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
  Toaster,
  Caption1,
  Label,
  useToastController,
  Toast,
  ToastTitle,
} from "@fluentui/react-components";
import { AddRegular, DeleteRegular, SaveRegular, ArrowResetRegular, SettingsRegular, DocumentTextRegular } from "@fluentui/react-icons";

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

  /* ===== 프롬프트 관리 영역 (스크린샷 스타일) ===== */
  manageCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
    marginBottom: tokens.spacingVerticalL,
  },
  manageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalM,
  },
  manageTitle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    fontWeight: tokens.fontWeightSemibold,
  },
  manageRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
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
  const { dispatchToast } = useToastController("prompts");

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
      const result = await window.api.invoke("prompts:getAll");
      if (result?.ok && Array.isArray(result.data)) setPrompts(result.data);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  /* ================= CRUD ================= */
  const handleCreateInline = async () => {
    try {
      const payload = { name: newName.trim(), category: mgrCategory, content: "" };
      if (!payload.name) return;

      const result = await window.api.invoke("prompts:create", payload);
      if (result?.ok) {
        await loadPrompts();
        setShowInlineCreate(false);
        setNewName("");

        // 새로 만든 항목을 선택
        const coll = prompts.filter((p) => p.category === mgrCategory);
        const created = (result?.data && result.data.id) || null;
        if (mgrCategory === "script" && created) setSelectedScriptId(created);
        if (mgrCategory === "reference" && created) setSelectedReferenceId(created);

        dispatchToast(
          <Toast>
            <ToastTitle>프롬프트가 생성되었습니다.</ToastTitle>
          </Toast>,
          { intent: "success" }
        );
      }
    } catch (e) {
      console.error(e);
      dispatchToast(
        <Toast>
          <ToastTitle>프롬프트 생성에 실패했습니다.</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  const handleDelete = async () => {
    try {
      const targetId = mgrCategory === "script" ? selectedScriptId : selectedReferenceId;
      if (!targetId) return;

      // 백엔드에 prompts:delete가 없다면 무시되며 토스트만 표시됩니다.
      const result = await window.api.invoke?.("prompts:delete", targetId);
      if (result?.ok) {
        await loadPrompts();
        if (mgrCategory === "script") {
          setSelectedScriptId("");
          setScriptPrompt("");
        } else {
          setSelectedReferenceId("");
          setReferencePrompt("");
        }
        dispatchToast(
          <Toast>
            <ToastTitle>삭제되었습니다.</ToastTitle>
          </Toast>,
          { intent: "success" }
        );
      } else {
        dispatchToast(
          <Toast>
            <ToastTitle>삭제 API가 없거나 실패했습니다.</ToastTitle>
          </Toast>,
          { intent: "warning" }
        );
      }
    } catch (e) {
      console.error(e);
      dispatchToast(
        <Toast>
          <ToastTitle>삭제 중 오류가 발생했습니다.</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  const handleSave = async (category, content) => {
    try {
      const promptId = category === "script" ? selectedScriptId : selectedReferenceId;
      if (!promptId) return;

      const result = await window.api.invoke("prompts:update", promptId, { content });
      if (result?.ok) {
        await loadPrompts();
        dispatchToast(
          <Toast>
            <ToastTitle>프롬프트가 저장되었습니다.</ToastTitle>
          </Toast>,
          { intent: "success" }
        );
      }
    } catch (e) {
      console.error(e);
      dispatchToast(
        <Toast>
          <ToastTitle>저장에 실패했습니다.</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  const handleSaveAll = async () => {
    if (selectedScriptId && scriptPrompt) await handleSave("script", scriptPrompt);
    if (selectedReferenceId && referencePrompt) await handleSave("reference", referencePrompt);
  };

  const handleReset = async (category) => {
    try {
      const result = await window.api.invoke("prompts:getDefault", category);
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

  return (
    <div className={styles.container}>
      <Toaster toasterId="prompts" position="top-end" />

      {/* Header (그대로) */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>🧠 프롬프트 템플릿 관리</div>
        <Caption1 className={styles.headerDescription}>
          AI 대본 생성과 레퍼런스 분석에 사용할 프롬프트 템플릿을 관리합니다.
          <br />
          카테고리별로 프롬프트를 생성하고 편집하여 더 나은 결과를 얻으세요.
        </Caption1>
      </div>

      {/* ===== 프롬프트 관리 (스크린샷 스타일) ===== */}
      <Card className={styles.manageCard}>
        <div className={styles.manageHeader}>
          <div className={styles.manageTitle}>
            <DocumentTextRegular />
            <Text weight="semibold">프롬프트 관리</Text>
          </div>

          {/* 화면상 카테고리 토글은 노출하지 않지만, 내부적으로 script 먼저 관리합니다.
              필요하면 아래 두 줄 중 하나를 주석 해제해 사용하세요. */}
          {/* <SegmentedControl .../> */}
        </div>

        <div className={styles.manageRow}>
          {/* 드롭다운: 현재 관리 카테고리(script 기준) */}
          <Dropdown
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

          {/* 새 프롬프트 */}
          <Button
            icon={<AddRegular />}
            appearance="primary"
            onClick={() => {
              setMgrCategory("script"); // 스크린샷과 동일 흐름(대본 중심)
              setShowInlineCreate(true);
            }}
          >
            새 프롬프트
          </Button>

          {/* 삭제 */}
          <Button
            appearance="secondary"
            icon={<DeleteRegular />}
            onClick={handleDelete}
            disabled={!currentSelectedId}
          >
            삭제
          </Button>
        </div>

        {/* 인라인 생성 박스 */}
        {showInlineCreate && (
          <div className={styles.inlineCreate}>
            <Input value={newName} onChange={(_, d) => setNewName(d.value)} placeholder="새 프롬프트 이름을 입력하세요" />
            <Button
              appearance="primary"
              icon={<SaveRegular />}
              onClick={handleCreateInline}
              disabled={!newName.trim()}
            >
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

        {/* 모두 저장 버튼은 기존 위치/동작 그대로 유지 */}
        <div style={{ marginTop: tokens.spacingVerticalM, textAlign: "right" }}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={handleSaveAll} disabled={loading}>
            모두 저장
          </Button>
        </div>
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
  );
}
