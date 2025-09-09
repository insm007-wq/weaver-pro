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
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  sectionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    ...shorthands.gap(tokens.spacingHorizontalL),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.margin('0', '0', tokens.spacingVerticalS, '0'),
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  sectionActions: {
    display: "flex",
    alignItems: "center", 
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  editorSection: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  editor: {
    minHeight: "200px",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
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
  charCount: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
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
  
  // 헤더 셀렉트박스용 상태
  const [selectedCategory, setSelectedCategory] = useState("script");

  // 다이얼로그 상태
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "script",
    content: "",
  });

  // 초기 데이터 로드
  useEffect(() => {
    loadPrompts();
  }, []);

  // 프롬프트 로드 후 기본값 설정
  useEffect(() => {
    const scriptDefault = prompts.find(p => p.category === "script" && p.isDefault);
    const referenceDefault = prompts.find(p => p.category === "reference" && p.isDefault);
    
    if (scriptDefault) {
      setScriptPrompt(scriptDefault.content);
      setSelectedScriptId(scriptDefault.id);
    }
    if (referenceDefault) {
      setReferencePrompt(referenceDefault.content);
      setSelectedReferenceId(referenceDefault.id);
    }
  }, [prompts]);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      
      // window.api가 없는 경우 대비
      if (!window.api || !window.api.invoke) {
        console.error("window.api is not available");
        setLoading(false);
        return;
      }
      
      const result = await window.api.invoke("prompts:getAll");
      if (result?.ok) {
        setPrompts(result.data || []);
      } else {
        console.error("Failed to load prompts:", result?.message);
        dispatchToast(
          <Toast>
            <ToastTitle>프롬프트 로드 실패: {result?.message || "알 수 없는 오류"}</ToastTitle>
          </Toast>,
          { intent: "error" }
        );
      }
    } catch (error) {
      console.error("Error loading prompts:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>프롬프트 로드 중 오류 발생: {error.message}</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!window.api || !window.api.invoke) {
        console.error("window.api is not available");
        return;
      }
      
      const result = await window.api.invoke("prompts:create", formData);
      if (result?.ok) {
        await loadPrompts();
        setShowCreateDialog(false);
        setFormData({ name: "", category: "script", content: "" });
        dispatchToast(
          <Toast>
            <ToastTitle>프롬프트가 생성되었습니다</ToastTitle>
          </Toast>,
          { intent: "success" }
        );
      } else {
        dispatchToast(
          <Toast>
            <ToastTitle>생성 실패: {result?.message || "알 수 없는 오류"}</ToastTitle>
          </Toast>,
          { intent: "error" }
        );
      }
    } catch (error) {
      console.error("Error creating prompt:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>생성 중 오류 발생: {error.message}</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  const handleSave = async (category, content) => {
    try {
      if (!window.api || !window.api.invoke) {
        console.error("window.api is not available");
        return;
      }
      
      const defaultPrompt = prompts.find(p => p.category === category && p.isDefault);
      
      if (defaultPrompt) {
        const result = await window.api.invoke("prompts:update", defaultPrompt.id, {
          content: content
        });
        
        if (result?.ok) {
          await loadPrompts();
          dispatchToast(
            <Toast>
              <ToastTitle>{category === "script" ? "대본" : "레퍼런스"} 프롬프트가 저장되었습니다</ToastTitle>
            </Toast>,
            { intent: "success" }
          );
        } else {
          dispatchToast(
            <Toast>
              <ToastTitle>저장 실패: {result?.message || "알 수 없는 오류"}</ToastTitle>
            </Toast>,
            { intent: "error" }
          );
        }
      }
    } catch (error) {
      console.error("Error saving prompt:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>저장 중 오류 발생: {error.message}</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  const handleReset = async (category) => {
    try {
      if (!window.api || !window.api.invoke) {
        console.error("window.api is not available");
        return;
      }
      
      const result = await window.api.invoke("prompts:getDefault", category);
      if (result?.ok && result?.data) {
        if (category === "script") {
          setScriptPrompt(result.data.content);
          setSelectedScriptId(result.data.id);
        } else if (category === "reference") {
          setReferencePrompt(result.data.content);
          setSelectedReferenceId(result.data.id);
        }
        dispatchToast(
          <Toast>
            <ToastTitle>{category === "script" ? "대본" : "레퍼런스"} 프롬프트가 초기화되었습니다</ToastTitle>
          </Toast>,
          { intent: "success" }
        );
      }
    } catch (error) {
      console.error("Error resetting prompt:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>초기화 중 오류 발생: {error.message}</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  // 프롬프트 선택 핸들러
  const handlePromptSelect = async (category, promptId) => {
    try {
      if (!window.api || !window.api.invoke) {
        console.error("window.api is not available");
        return;
      }
      
      const result = await window.api.invoke("prompts:getById", promptId);
      if (result?.ok && result?.data) {
        if (category === "script") {
          setScriptPrompt(result.data.content);
          setSelectedScriptId(promptId);
        } else if (category === "reference") {
          setReferencePrompt(result.data.content);
          setSelectedReferenceId(promptId);
        }
      }
    } catch (error) {
      console.error("Error loading selected prompt:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>프롬프트 로드 중 오류 발생: {error.message}</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  // 통합 저장 함수
  const handleSaveAll = async () => {
    try {
      // 대본 프롬프트 저장
      if (selectedScriptId && scriptPrompt) {
        await handleSave("script", scriptPrompt);
      }
      
      // 레퍼런스 프롬프트 저장
      if (selectedReferenceId && referencePrompt) {
        await handleSave("reference", referencePrompt);
      }
      
      dispatchToast(
        <Toast>
          <ToastTitle>모든 프롬프트가 저장되었습니다</ToastTitle>
        </Toast>,
        { intent: "success" }
      );
    } catch (error) {
      console.error("Error saving all prompts:", error);
      dispatchToast(
        <Toast>
          <ToastTitle>저장 중 오류 발생: {error.message}</ToastTitle>
        </Toast>,
        { intent: "error" }
      );
    }
  };

  const scriptCount = scriptPrompt.length;
  const referenceCount = referencePrompt.length;
  
  // 카테고리별 프롬프트 목록
  const scriptPrompts = prompts.filter(p => p.category === "script");
  const referencePrompts = prompts.filter(p => p.category === "reference");
  
  // API가 없는 경우 fallback UI
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

  return (
    <div className={styles.container}>
      <Toaster toasterId="prompts" position="top-end" />

      {/* 헤더 */}
      <Card>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerTitle}>
              <DocumentTextRegular />
              <Text weight="semibold" size={500}>프롬프트 관리</Text>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Dropdown
              value={selectedCategory === "script" ? "대본 생성" : "레퍼런스 분석"}
              onOptionSelect={(_, data) => setSelectedCategory(data.optionValue)}
              style={{ minWidth: "150px" }}
            >
              <Option value="script">대본 생성</Option>
              <Option value="reference">레퍼런스 분석</Option>
            </Dropdown>
            
            <Dialog open={showCreateDialog} onOpenChange={(_, data) => setShowCreateDialog(data.open)}>
              <DialogTrigger disableButtonEnhancement>
                <Button 
                  appearance="secondary" 
                  icon={<AddRegular />}
                  onClick={() => {
                    setFormData({ name: "", category: selectedCategory, content: "" });
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
                        placeholder="프롬프트 내용을 입력하세요. {{variable}} 형태로 변수를 사용할 수 있습니다."
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
              저장
            </Button>
          </div>
        </div>
      </Card>

      {/* 2열 섹션 레이아웃 */}
      <div className={styles.sectionsGrid}>
        {/* 대본 생성 섹션 */}
        <Card>
          <div className={styles.editorSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Text weight="semibold" size={500}>📝 대본 생성</Text>
              </div>
              <div className={styles.sectionActions}>
                <Button
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Text className={styles.charCount}>
                {scriptCount.toLocaleString()} 글자 | 변수: {"{topic}, {duration}, {style}"}
              </Text>
            </div>
          </div>
        </Card>

        {/* 레퍼런스 분석 섹션 */}
        <Card>
          <div className={styles.editorSection}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <Text weight="semibold" size={500}>🔍 레퍼런스 분석</Text>
              </div>
              <div className={styles.sectionActions}>
                <Button
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Text className={styles.charCount}>
                {referenceCount.toLocaleString()} 글자 | 변수: {"{referenceScript}, {topic}"}
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}