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
  Badge,
  Card,
  CardHeader,
  Divider,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  Toast,
  ToastTitle,
  useToastController,
  Toaster,
  Caption1,
  Label,
} from "@fluentui/react-components";
import {
  AddRegular,
  EditRegular,
  DeleteRegular,
  SaveRegular,
  DismissRegular,
  DocumentTextRegular,
  FilterRegular,
  ArrowResetRegular,
  SettingsRegular,
} from "@fluentui/react-icons";

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

  templateSection: {
    marginBottom: tokens.spacingVerticalL,
  },

  templateActions: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginBottom: tokens.spacingVerticalM,
  },

  templateTextarea: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: "1.4",
    minHeight: "300px",
  },

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

  sectionActions: {
    display: "flex",
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

  dialogContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
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
  
  // 다이얼로그 상태
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "script",
    content: "",
  });

  // API 사용 가능성 체크
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

  // 초기 데이터 로드
  useEffect(() => {
    loadPrompts();
  }, []);

  // 프롬프트 로드 후 기본값 설정
  useEffect(() => {
    const scriptDefault = prompts.find(p => p.category === "script" && p.isDefault);
    const referenceDefault = prompts.find(p => p.category === "reference" && p.isDefault);
    
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
      if (result?.ok && Array.isArray(result.data)) {
        setPrompts(result.data);
      }
    } catch (error) {
      console.error("Failed to load prompts:", error);
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const result = await window.api.invoke("prompts:create", formData);
      if (result?.ok) {
        await loadPrompts();
        setShowCreateDialog(false);
        setFormData({ name: "", category: "script", content: "" });
        
        dispatchToast(
          <Toast>
            <ToastTitle>프롬프트가 생성되었습니다.</ToastTitle>
          </Toast>,
          { intent: "success" }
        );
      }
    } catch (error) {
      console.error("Create error:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>프롬프트 생성에 실패했습니다.</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  const handleSave = async (category, content) => {
    try {
      const promptId = category === "script" ? selectedScriptId : selectedReferenceId;
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
    } catch (error) {
      console.error("Save error:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>저장에 실패했습니다.</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  const handleSaveAll = async () => {
    try {
      if (selectedScriptId && scriptPrompt) {
        await handleSave("script", scriptPrompt);
      }
      if (selectedReferenceId && referencePrompt) {
        await handleSave("reference", referencePrompt);
      }
    } catch (error) {
      console.error("Error saving all prompts:", error);
    }
  };

  const handleReset = async (category) => {
    try {
      const result = await window.api.invoke("prompts:getDefault", category);
      if (result?.ok && result.data) {
        if (category === "script") {
          setScriptPrompt(result.data.content || "");
          setSelectedScriptId(result.data.id);
        } else if (category === "reference") {
          setReferencePrompt(result.data.content || "");
          setSelectedReferenceId(result.data.id);
        }
      }
    } catch (error) {
      console.error("Reset error:", error);
    }
  };

  const scriptCount = scriptPrompt ? scriptPrompt.length : 0;
  const referenceCount = referencePrompt ? referencePrompt.length : 0;

  return (
    <div className={styles.container}>
      <Toaster toasterId="prompts" position="top-end" />
      
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>🧠 프롬프트 템플릿 관리</div>
        <Caption1 className={styles.headerDescription}>
          AI 대본 생성과 레퍼런스 분석에 사용할 프롬프트 템플릿을 관리합니다.<br />
          카테고리별로 프롬프트를 생성하고 편집하여 더 나은 결과를 얻으세요.
        </Caption1>
      </div>

      {/* Main Settings Card */}
      <Card className={styles.settingsCard}>
        <div className={styles.templateSection}>
          {/* 프롬프트 관리 액션 */}
          <div className={styles.templateActions}>
            <Dialog open={showCreateDialog} onOpenChange={(_, data) => setShowCreateDialog(data.open)}>
              <DialogTrigger disableButtonEnhancement>
                <Button 
                  appearance="secondary" 
                  icon={<AddRegular />}
                  onClick={() => {
                    setFormData({ name: "", category: "script", content: "" });
                    setShowCreateDialog(true);
                  }}
                >
                  새 프롬프트
                </Button>
              </DialogTrigger>
              <DialogSurface style={{ maxWidth: "800px", maxHeight: "90vh" }}>
                <DialogTitle>새 프롬프트 생성</DialogTitle>
                <DialogBody>
                  <div className={styles.dialogContent}>
                    <Field label="이름">
                      <Input
                        value={formData.name}
                        onChange={(_, data) => setFormData(prev => ({ ...prev, name: data.value }))}
                        placeholder="프롬프트 이름을 입력하세요"
                      />
                    </Field>
                    <Field label="카테고리">
                      <Dropdown
                        value={formData.category === "script" ? "대본 생성" : formData.category === "reference" ? "레퍼런스 분석" : "썸네일 생성"}
                        onOptionSelect={(_, data) => 
                          setFormData(prev => ({ ...prev, category: data.optionValue }))
                        }
                      >
                        <Option value="script">대본 생성</Option>
                        <Option value="reference">레퍼런스 분석</Option>
                        <Option value="thumbnail">썸네일 생성</Option>
                      </Dropdown>
                    </Field>
                    <Field label="프롬프트 내용">
                      <Textarea
                        className={styles.editorField}
                        value={formData.content}
                        onChange={(_, data) => setFormData(prev => ({ ...prev, content: data.value }))}
                        placeholder="프롬프트 내용을 입력하세요. {variable} 형태로 변수를 사용할 수 있습니다."
                        resize="vertical"
                      />
                    </Field>
                  </div>
                </DialogBody>
                <DialogActions>
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="secondary">취소</Button>
                  </DialogTrigger>
                  <Button 
                    appearance="primary" 
                    icon={<SaveRegular />}
                    onClick={handleCreate}
                    disabled={!formData.name.trim() || !formData.content.trim()}
                  >
                    생성
                  </Button>
                </DialogActions>
              </DialogSurface>
            </Dialog>
            
            <Button
              appearance="primary"
              icon={<SaveRegular />}
              onClick={handleSaveAll}
              disabled={loading}
            >
              모두 저장
            </Button>
          </div>

          {/* 변수 도움말 */}
          <div className={styles.variableHelp}>
            <Label weight="semibold" size="small">
              <SettingsRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
              사용 가능한 변수
            </Label>
            <Caption1>프롬프트에서 다음 변수들을 사용할 수 있습니다:</Caption1>
            <div className={styles.variableList}>
              <div className={styles.variableTag}>{"{topic}"}</div>
              <div className={styles.variableTag}>{"{duration}"}</div>
              <div className={styles.variableTag}>{"{style}"}</div>
              <div className={styles.variableTag}>{"{referenceScript}"}</div>
              <div className={styles.variableTag}>{"{content}"}</div>
            </div>
          </div>
        </div>

        {/* 프롬프트 에디터 섹션 */}
        <div className={styles.sectionsGrid}>
          {/* 대본 생성 섹션 */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Text weight="semibold" size={500}>📝 대본 생성</Text>
              </div>
              <div className={styles.sectionActions}>
                <Button
                  size="small"
                  icon={<ArrowResetRegular />}
                  onClick={() => handleReset("script")}
                  disabled={loading}
                >
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
                <Text weight="semibold" size={500}>🔍 레퍼런스 분석</Text>
              </div>
              <div className={styles.sectionActions}>
                <Button
                  size="small"
                  icon={<ArrowResetRegular />}
                  onClick={() => handleReset("reference")}
                  disabled={loading}
                >
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