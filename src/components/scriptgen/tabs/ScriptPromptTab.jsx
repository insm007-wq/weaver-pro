// src/components/tabs/ScriptPromptTab.jsx
import React, { useEffect, useMemo, useState } from "react";
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
} from "@fluentui/react-components";
import { 
  AddRegular, 
  DeleteRegular, 
  SaveRegular, 
  ArrowResetRegular,
  DocumentTextRegular,
} from "@fluentui/react-icons";
import {
  LLM_OPTIONS,
  TTS_ENGINES,
  VOICES_BY_ENGINE,
  DEFAULT_GENERATE_PROMPT,
} from "../constants";
import { handleError, handleApiError } from "@utils";

// 간단 slugify
function slugify(name = "") {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
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
  createForm: {
    ...shorthands.padding(tokens.spacingVerticalL),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
  },
  createActions: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginTop: tokens.spacingVerticalM,
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    ...shorthands.gap(tokens.spacingVerticalM, tokens.spacingHorizontalM),
  },
  editorSection: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalS),
  },
  editor: {
    minHeight: "300px",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...shorthands.padding(tokens.spacingVerticalM, "0", "0", "0"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
  },
  actionButtons: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  savedIndicator: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

export default function ScriptPromptTab({
  template,
  setTemplate,
  form,
  onChange,
  voices,
  savedAt,
  onSave,
  onReset,
  disabled = false,
}) {
  const styles = useStyles();
  
  // 전역 프롬프트 시스템
  const [prompts, setPrompts] = useState([]);
  const [currentId, setCurrentId] = useState("default-script");
  const [savingAt, setSavingAt] = useState(null);

  // 새 프롬프트 UI
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  // 스크립트 카테고리 프롬프트만 필터링
  const scriptPrompts = prompts.filter(p => p.category === "script");
  const countTotal = scriptPrompts.length;

  // 초기 로드 - 전역 프롬프트 시스템 사용
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const result = await window?.api?.invoke("prompts:getByCategory", "script");
      if (result?.ok) {
        setPrompts(result.data);
        // 기본 프롬프트 선택
        const defaultPrompt = result.data.find(p => p.isDefault);
        if (defaultPrompt && !template) {
          setCurrentId(defaultPrompt.id);
          setTemplate(defaultPrompt.content);
        }
      }
    } catch (error) {
      const { message } = handleApiError(error, "prompt_loading", {
        metadata: { category: "script", action: "load" }
      });
      console.error("Failed to load prompts:", message);
    }
  };

  // 프롬프트 선택 시 본문 로드
  const handleSelect = async (_, data) => {
    const id = data.optionValue;
    try {
      setCurrentId(id);
      
      const result = await window?.api?.invoke("prompts:getById", id);
      if (result?.ok && result.data) {
        setTemplate(result.data.content);
      } else {
        // fallback to default
        const defaultResult = await window?.api?.invoke("prompts:getDefault", "script");
        if (defaultResult?.ok && defaultResult.data) {
          setTemplate(defaultResult.data.content);
        } else {
          setTemplate(DEFAULT_GENERATE_PROMPT);
        }
      }
    } catch (error) {
      const { message } = handleApiError(error, "prompt_loading", {
        metadata: { action: "load_by_id", promptId: id }
      });
      console.error("Failed to load prompt:", message);
      setTemplate(DEFAULT_GENERATE_PROMPT);
    }
  };

  // 저장
  const handleSave = async () => {
    try {
      const currentPrompt = scriptPrompts.find(p => p.id === currentId);
      
      if (currentPrompt) {
        // 기존 프롬프트 업데이트
        const result = await window?.api?.invoke("prompts:update", currentId, {
          content: template
        });
        
        if (result?.ok) {
          await loadPrompts(); // 목록 새로고침
          setSavingAt(new Date());
        } else {
          console.error("Failed to save prompt:", result?.message);
        }
      } else {
        // 새 프롬프트로 저장 (기본값이 없는 경우)
        const result = await window?.api?.invoke("prompts:create", {
          name: "대본 프롬프트",
          category: "script", 
          content: template
        });
        
        if (result?.ok) {
          setCurrentId(result.data.id);
          await loadPrompts();
          setSavingAt(new Date());
        }
      }
    } catch (error) {
      const { message } = handleApiError(error, "prompt_save", {
        metadata: { action: "save", promptId: currentId }
      });
      console.error("Save error:", message);
    }
  };

  // 기본값으로 초기화
  const handleReset = async () => {
    try {
      const result = await window?.api?.invoke("prompts:getDefault", "script");
      if (result?.ok && result.data) {
        setTemplate(result.data.content);
        setCurrentId(result.data.id);
      } else {
        setTemplate(DEFAULT_GENERATE_PROMPT);
      }
    } catch (error) {
      const { message } = handleApiError(error, "prompt_reset", {
        metadata: { action: "reset", category: "script" }
      });
      console.error("Reset error:", message);
      setTemplate(DEFAULT_GENERATE_PROMPT);
    }
  };

  // 새 프롬프트 생성
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    
    try {
      const result = await window?.api?.invoke("prompts:create", {
        name,
        category: "script",
        content: template || DEFAULT_GENERATE_PROMPT
      });
      
      if (result?.ok) {
        setCurrentId(result.data.id);
        await loadPrompts();
        setCreating(false);
        setNewName("");
      } else {
        console.error("Failed to create prompt:", result?.message);
      }
    } catch (error) {
      const { message } = handleApiError(error, "prompt_create", {
        metadata: { action: "create", name, category: "script" }
      });
      console.error("Create error:", message);
    }
  };

  // 프롬프트 삭제
  const handleDelete = async () => {
    const currentPrompt = scriptPrompts.find(p => p.id === currentId);
    if (!currentPrompt || currentPrompt.isDefault) return;
    
    try {
      const result = await window?.api?.invoke("prompts:delete", currentId);
      if (result?.ok) {
        // 기본 프롬프트로 전환
        const defaultResult = await window?.api?.invoke("prompts:getDefault", "script");
        if (defaultResult?.ok && defaultResult.data) {
          setCurrentId(defaultResult.data.id);
          setTemplate(defaultResult.data.content);
        } else {
          setTemplate(DEFAULT_GENERATE_PROMPT);
        }
        
        await loadPrompts();
      } else {
        console.error("Failed to delete prompt:", result?.message);
      }
    } catch (error) {
      const { message } = handleApiError(error, "prompt_delete", {
        metadata: { action: "delete", promptId: currentId }
      });
      console.error("Delete error:", message);
    }
  };

  const savedLabel = savedAt || savingAt;
  const currentPrompt = scriptPrompts.find(p => p.id === currentId);
  const selectedOption = currentPrompt?.name || "기본 프롬프트";

  return (
    <div className={styles.container}>
      {/* 프롬프트 관리 헤더 */}
      <Card>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerTitle}>
              <DocumentTextRegular />
              <Text weight="semibold" size={500}>프롬프트 관리</Text>
              <Badge appearance="tint" size="small">{countTotal}개</Badge>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Dropdown
              value={selectedOption}
              onOptionSelect={handleSelect}
              disabled={disabled}
            >
              {scriptPrompts.map((prompt) => (
                <Option key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </Option>
              ))}
            </Dropdown>
            
            <Button
              appearance="primary"
              icon={<AddRegular />}
              onClick={() => setCreating(!creating)}
              disabled={disabled}
            >
              새 프롬프트
            </Button>
            
            <Button
              appearance="subtle"
              icon={<DeleteRegular />}
              onClick={handleDelete}
              disabled={!currentPrompt || currentPrompt?.isDefault || disabled}
            >
              삭제
            </Button>
          </div>
        </div>
      </Card>

      {/* 새 프롬프트 생성 폼 */}
      {creating && (
        <Card className={styles.createForm}>
          <Text weight="semibold" size={400}>새 프롬프트 생성</Text>
          <Field label="프롬프트 이름" style={{ marginTop: tokens.spacingVerticalM }}>
            <Input
              autoFocus
              placeholder="새 프롬프트 이름을 입력하세요"
              value={newName}
              onChange={(_, data) => setNewName(data.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
            />
          </Field>
          <div className={styles.createActions}>
            <Button 
              appearance="primary" 
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              생성
            </Button>
            <Button onClick={() => setCreating(false)}>
              취소
            </Button>
          </div>
        </Card>
      )}

      {/* 실행 설정 */}
      <Card>
        <CardHeader
          header={
            <Text weight="semibold" size={400}>⚙️ 실행 설정</Text>
          }
        />
        <div className={styles.settingsGrid}>
          <Field label="LLM 모델">
            <Dropdown
              value={LLM_OPTIONS.find(opt => opt.value === form.llmMain)?.label || ""}
              onOptionSelect={(_, data) => onChange("llmMain", data.optionValue)}
              disabled={disabled}
            >
              {LLM_OPTIONS.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="TTS 엔진">
            <Dropdown
              value={TTS_ENGINES.find(opt => opt.value === form.ttsEngine)?.label || ""}
              onOptionSelect={(_, data) => {
                onChange("ttsEngine", data.optionValue);
                const vs = VOICES_BY_ENGINE[data.optionValue] || [];
                if (vs.length) onChange("voiceName", vs[0]);
              }}
              disabled={disabled}
            >
              {TTS_ENGINES.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="보이스">
            <Dropdown
              value={form.voiceName || ""}
              onOptionSelect={(_, data) => onChange("voiceName", data.optionValue)}
              disabled={disabled}
            >
              {(voices || []).map((voice) => (
                <Option key={voice} value={voice}>
                  {voice}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>
      </Card>

      {/* 프롬프트 에디터 */}
      <Card>
        <div className={styles.editorSection}>
          <Text weight="semibold" size={500}>📝 대본 프롬프트</Text>
          <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
            AI가 대본을 생성할 때 사용할 프롬프트를 작성하세요
          </Text>
          <Field>
            <Textarea
              className={styles.editor}
              value={template || ""}
              onChange={(_, data) => setTemplate(data.value)}
              disabled={disabled}
              resize="vertical"
            />
          </Field>
        </div>

        {/* 액션 버튼 */}
        <div className={styles.actions}>
          <div className={styles.actionButtons}>
            <Button
              icon={<ArrowResetRegular />}
              onClick={handleReset}
              disabled={disabled}
            >
              기본값으로 초기화
            </Button>
            <Button
              appearance="primary"
              icon={<SaveRegular />}
              onClick={handleSave}
              disabled={disabled}
            >
              저장
            </Button>
          </div>
          {savedLabel && (
            <Text className={styles.savedIndicator}>
              저장됨: {new Date(savedLabel).toLocaleTimeString()}
            </Text>
          )}
        </div>
      </Card>
    </div>
  );
}