import React, { useState, useEffect } from "react";
import {
  Text,
  Button,
  Field,
  Input,
  Card,
  CardHeader,
  Caption1,
  Label,
  tokens,
  Divider,
  MessageBar,
  MessageBarBody,
  Badge,
  Title2,
  Title3,
  Body2,
  Spinner
} from "@fluentui/react-components";
import {
  FolderRegular,
  InfoRegular,
  SaveRegular,
  ArrowResetRegular,
  DocumentRegular,
  AddRegular,
  DeleteRegular,
  FolderOpenRegular,
  CheckmarkCircleRegular,
  PlayRegular,
  ClockRegular
} from "@fluentui/react-icons";
import { useContainerStyles, useCardStyles, useSettingsStyles, useHeaderStyles } from "../styles/commonStyles";
import { showGlobalToast } from "./common/GlobalToast";
import { useApi } from "../hooks/useApi";

// 기본 프로젝트 설정 (단순화된 구조)
const DEFAULT_PROJECT_SETTINGS = {
  projectRootFolder: "C:\\WeaverPro\\",
  defaultProjectName: "WeaverPro-Project",
  autoCreateFolders: true,
};

export default function ProjectManager() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const headerStyles = useHeaderStyles();
  const api = useApi();

  // 프로젝트 설정 상태
  const [settings, setSettings] = useState(DEFAULT_PROJECT_SETTINGS);
  const [isModified, setIsModified] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(DEFAULT_PROJECT_SETTINGS);

  // 프로젝트 목록 상태
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);

  // 새 프로젝트 생성 상태
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectTopic, setNewProjectTopic] = useState("");
  const [creating, setCreating] = useState(false);
  const [forceInputRerender, setForceInputRerender] = useState(0);

  // 초기 로드
  useEffect(() => {
    console.log("🎯 ProjectManager 컴포넌트 마운트됨");
    loadSettings();
    loadProjects();
    loadCurrentProject();
  }, []);

  // 수정 감지
  useEffect(() => {
    setIsModified(JSON.stringify(settings) !== JSON.stringify(originalSettings));
  }, [settings, originalSettings]);

  // 상태 변화 디버깅
  useEffect(() => {
    console.log("🔄 상태 변화 감지:", {
      newProjectTopic,
      showCreateForm,
      creating,
      projects: projects.length
    });
  }, [newProjectTopic, showCreateForm, creating, projects]);

  const loadSettings = async () => {
    try {
      console.log("⚙️ 프로젝트 설정 로드 시작...");
      const projectRootFolder = await window.api.getSetting("projectRootFolder");
      const defaultProjectName = await window.api.getSetting("defaultProjectName");
      
      console.log("📂 로드된 설정:");
      console.log("   projectRootFolder:", projectRootFolder);
      console.log("   defaultProjectName:", defaultProjectName);
      
      const loadedSettings = {
        projectRootFolder: projectRootFolder || DEFAULT_PROJECT_SETTINGS.projectRootFolder,
        defaultProjectName: defaultProjectName || DEFAULT_PROJECT_SETTINGS.defaultProjectName,
        autoCreateFolders: true,
      };

      console.log("✅ 최종 설정:", loadedSettings);
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
    } catch (error) {
      console.error("❌ 프로젝트 설정 로드 실패:", error);
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      console.log("🔍 프로젝트 목록 로드 시작...");
      const result = await api.invoke("project:list");
      console.log("📋 프로젝트 목록 결과:", result);
      
      if (result.success) {
        // API 응답 구조 확인: result.data.projects 또는 result.projects
        const projects = result.data?.projects || result.projects || [];
        console.log("✅ 로드된 프로젝트 수:", projects.length);
        console.log("📂 프로젝트 목록:", projects.map(p => ({ id: p.id, topic: p.topic })));
        setProjects(projects);
      } else {
        console.error("❌ 프로젝트 목록 로드 실패:", result.message);
      }
    } catch (error) {
      console.error("❌ 프로젝트 목록 로드 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentProject = async () => {
    try {
      const result = await api.invoke("project:current");
      if (result.success && result.project) {
        setCurrentProject(result.project);
      }
    } catch (error) {
      console.error("현재 프로젝트 로드 오류:", error);
    }
  };

  const saveSettings = async () => {
    try {
      await window.api.setSetting({
        key: "projectRootFolder",
        value: settings.projectRootFolder,
      });
      await window.api.setSetting({
        key: "defaultProjectName", 
        value: settings.defaultProjectName,
      });

      setOriginalSettings(settings);
      showGlobalToast({
        type: "success",
        text: "프로젝트 설정이 저장되었습니다! 🎉",
      });
    } catch (error) {
      console.error("프로젝트 설정 저장 실패:", error);
      showGlobalToast({
        type: "error",
        text: "프로젝트 설정 저장에 실패했습니다.",
      });
    }
  };

  const selectFolder = async () => {
    try {
      const result = await api.invoke("dialog:selectFolder");
      
      if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
        setSettings((prev) => ({ ...prev, projectRootFolder: result.filePaths[0] }));
        showGlobalToast({
          type: "success",
          text: "프로젝트 폴더가 선택되었습니다!",
        });
      }
    } catch (error) {
      console.error("폴더 선택 실패:", error);
      showGlobalToast({
        type: "error",
        text: "폴더 선택에 실패했습니다.",
      });
    }
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_PROJECT_SETTINGS);
    setOriginalSettings(DEFAULT_PROJECT_SETTINGS);
    
    try {
      await window.api.setSetting({ key: "projectRootFolder", value: DEFAULT_PROJECT_SETTINGS.projectRootFolder });
      await window.api.setSetting({ key: "defaultProjectName", value: DEFAULT_PROJECT_SETTINGS.defaultProjectName });
      
      showGlobalToast({
        type: "success",
        text: "프로젝트 설정이 초기화되었습니다!",
      });
    } catch (error) {
      console.error("설정 초기화 실패:", error);
      showGlobalToast({
        type: "error",
        text: "설정 초기화에 실패했습니다.",
      });
    }
  };

  const createNewProject = async () => {
    if (!newProjectTopic.trim()) {
      showGlobalToast({
        type: "error",
        text: "프로젝트 주제를 입력해주세요.",
      });
      return;
    }

    setCreating(true);
    try {
      console.log("🚀 프로젝트 생성 시작:", newProjectTopic.trim());
      const result = await api.invoke("project:create", {
        topic: newProjectTopic.trim(),
        options: {}
      });
      console.log("📦 프로젝트 생성 결과:", result);

      if (result.success) {
        console.log("✅ 프로젝트 생성 성공, UI 업데이트 시작...");
        showGlobalToast({
          type: "success",
          text: `프로젝트 "${newProjectTopic}"가 생성되었습니다!`,
        });
        setNewProjectTopic("");
        setShowCreateForm(false);
        
        console.log("🔄 프로젝트 목록 새로고침 중...");
        await loadProjects();
        console.log("🔄 현재 프로젝트 새로고침 중...");
        await loadCurrentProject();
        console.log("✅ UI 업데이트 완료");
      } else {
        console.error("❌ 프로젝트 생성 실패:", result.message);
        showGlobalToast({
          type: "error",
          text: `프로젝트 생성 실패: ${result.message}`,
        });
      }
    } catch (error) {
      console.error("❌ 프로젝트 생성 오류:", error);
      showGlobalToast({
        type: "error",
        text: "프로젝트 생성에 실패했습니다.",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (projectId) => {
    if (!confirm("정말로 이 프로젝트를 삭제하시겠습니까?")) {
      return;
    }

    try {
      console.log("🗑️ 프로젝트 삭제 시작:", projectId);
      const result = await api.invoke("project:delete", projectId);
      console.log("📦 프로젝트 삭제 결과:", result);
      
      if (result.success) {
        console.log("✅ 프로젝트 삭제 성공, UI 업데이트 시작...");

        // 상태 초기화 (입력 필드 문제 해결을 위해)
        console.log("🔄 상태 초기화...");
        setNewProjectTopic("");
        setShowCreateForm(false);
        setCreating(false);
        setForceInputRerender(prev => prev + 1);

        // 강제 상태 리셋 (React 상태 동기화 문제 해결)
        setTimeout(() => {
          console.log("🔄 지연된 상태 재초기화...");
          setNewProjectTopic("");
          setForceInputRerender(prev => prev + 1);
        }, 100);

        showGlobalToast({
          type: "success",
          text: "프로젝트가 삭제되었습니다.",
        });

        console.log("🔄 삭제 후 프로젝트 목록 새로고침...");
        await loadProjects();
        console.log("🔄 삭제 후 현재 프로젝트 새로고침...");
        await loadCurrentProject();
        console.log("✅ 삭제 후 UI 업데이트 완료");
      } else {
        console.error("❌ 프로젝트 삭제 실패:", result.message);
        showGlobalToast({
          type: "error",
          text: `프로젝트 삭제 실패: ${result.message}`,
        });
      }
    } catch (error) {
      console.error("❌ 프로젝트 삭제 오류:", error);
      showGlobalToast({
        type: "error",
        text: "프로젝트 삭제에 실패했습니다.",
      });
    }
  };

  const openOutputFolder = async () => {
    try {
      const result = await api.invoke("project:openOutputFolder");
      if (result.success) {
        showGlobalToast({
          type: "success",
          text: "출력 폴더를 열었습니다.",
        });
      } else {
        showGlobalToast({
          type: "error",
          text: result.message || "폴더 열기에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("폴더 열기 오류:", error);
      showGlobalToast({
        type: "error",
        text: "폴더 열기에 실패했습니다.",
      });
    }
  };

  // 스타일 관련 상수
  const sectionGap = tokens.spacingVerticalXXL;
  const itemGap = tokens.spacingHorizontalXL;

  return (
    <div className={containerStyles.container}>
      {/* 헤더 */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <DocumentRegular />
          프로젝트 관리
        </div>
        <div className={headerStyles.pageDescription}>
          새 프로젝트 생성 및 관리 - 영상 생성 프로젝트를 체계적으로 관리합니다.
        </div>
        <div className={headerStyles.divider} />
      </div>

      {/* 현재 활성 프로젝트 */}
      {currentProject && (
        <Card style={{ marginBottom: sectionGap, padding: tokens.spacingVerticalL, backgroundColor: tokens.colorPaletteLightGreenBackground1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Text size={400} weight="semibold" style={{ display: "block", marginBottom: tokens.spacingVerticalXS }}>
                📁 현재 활성 프로젝트
              </Text>
              <Text size={300}>
                {currentProject.topic} ({currentProject.id})
              </Text>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                생성일: {new Date(currentProject.createdAt).toLocaleString()}
              </Caption1>
            </div>
            <Button
              appearance="primary"
              icon={<FolderOpenRegular />}
              onClick={openOutputFolder}
            >
              출력 폴더 열기
            </Button>
          </div>
        </Card>
      )}

      {/* 새 프로젝트 생성 */}
      <Card style={{ marginBottom: sectionGap, padding: tokens.spacingVerticalL }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.spacingVerticalM }}>
          <Text size={500} weight="semibold">
            🆕 새 프로젝트 생성
          </Text>
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => {
              console.log("➕ 새 프로젝트 버튼 클릭됨:", {
                currentShowCreateForm: showCreateForm,
                newShowCreateForm: !showCreateForm,
                currentTopic: newProjectTopic,
                creating: creating
              });

              if (!showCreateForm) {
                // 폼을 열 때 확실히 초기화
                console.log("🔄 새 프로젝트 폼 열기 - 상태 초기화");
                setNewProjectTopic("");
                setCreating(false);
                setForceInputRerender(prev => prev + 1);
              }

              setShowCreateForm(!showCreateForm);
            }}
          >
            새 프로젝트
          </Button>
        </div>

        {showCreateForm && (
          <div key="create-form" style={{ marginTop: tokens.spacingVerticalM }}>
            <Field label="프로젝트 주제" required>
              <Input
                key={`project-input-${projects.length}-${forceInputRerender}`}
                value={newProjectTopic}
                onChange={(_, data) => {
                  console.log("📝 Input onChange 호출됨:", {
                    newValue: data.value,
                    currentValue: newProjectTopic,
                    creating: creating,
                    showCreateForm: showCreateForm
                  });
                  setNewProjectTopic(data.value);
                }}
                placeholder="예: 유튜브 마케팅 전략, 요리 레시피 소개 등"
                contentBefore={<DocumentRegular />}
                disabled={creating}
                onFocus={() => console.log("📝 Input 포커스됨")}
                onBlur={() => console.log("📝 Input 포커스 해제됨")}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <div style={{ display: "flex", gap: "8px", marginTop: tokens.spacingVerticalM }}>
              <Button 
                appearance="primary" 
                onClick={createNewProject}
                disabled={creating || !newProjectTopic.trim()}
                icon={creating ? <Spinner size="tiny" /> : <AddRegular />}
              >
                {creating ? "생성 중..." : "프로젝트 생성"}
              </Button>
              <Button 
                appearance="secondary" 
                onClick={() => setShowCreateForm(false)}
              >
                취소
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 프로젝트 목록 */}
      <Card style={{ marginBottom: sectionGap, padding: tokens.spacingVerticalL }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.spacingVerticalM }}>
          <Text size={500} weight="semibold">
            📋 프로젝트 목록
          </Text>
          <Button
            appearance="secondary"
            onClick={() => {
              console.log("🔄 수동 새로고침 시작...");
              console.log("현재 UI 설정:", settings);
              loadProjects();
            }}
            disabled={loading}
            icon={loading ? <Spinner size="tiny" /> : undefined}
          >
            새로고침
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: tokens.spacingVerticalXXL }}>
            <Spinner size="medium" />
            <Text style={{ marginTop: tokens.spacingVerticalM }}>프로젝트 목록을 불러오는 중...</Text>
          </div>
        ) : projects.length === 0 ? (
          <MessageBar intent="info">
            <MessageBarBody>
              생성된 프로젝트가 없습니다. 새 프로젝트를 생성해보세요.
            </MessageBarBody>
          </MessageBar>
        ) : (
          <div style={{ display: "grid", gap: tokens.spacingVerticalM }}>
            {projects.map((project) => (
              <Card key={project.id} style={{ padding: tokens.spacingVerticalM, backgroundColor: tokens.colorNeutralBackground2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <Text weight="semibold">{project.topic}</Text>
                      {currentProject?.id === project.id && (
                        <Badge appearance="filled" color="success" icon={<CheckmarkCircleRegular />}>
                          활성
                        </Badge>
                      )}
                    </div>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      ID: {project.id}
                    </Caption1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      생성일: {new Date(project.createdAt).toLocaleString()}
                    </Caption1>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Button
                      appearance="subtle"
                      icon={<FolderOpenRegular />}
                      size="small"
                      onClick={() => {
                        // 임시로 해당 프로젝트를 현재 프로젝트로 설정하고 폴더 열기
                        api.invoke("project:load", project.id).then(() => {
                          openOutputFolder();
                        });
                      }}
                    >
                      폴더 열기
                    </Button>
                    <Button
                      appearance="subtle"
                      icon={<DeleteRegular />}
                      size="small"
                      onClick={() => deleteProject(project.id)}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* 프로젝트 설정 */}
      <Card style={{ padding: sectionGap }}>
        <Text
          size={500}
          weight="semibold"
          style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: tokens.spacingVerticalM }}
        >
          <FolderRegular /> 프로젝트 경로 설정
        </Text>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: itemGap, marginBottom: tokens.spacingVerticalL }}>
          <Field label="프로젝트 루트 폴더" hint="모든 프로젝트가 생성될 기본 폴더입니다.">
            <div className={settingsStyles.folderSection}>
              <Input
                className={settingsStyles.folderInput}
                value={settings.projectRootFolder}
                onChange={(_, data) => setSettings((prev) => ({ ...prev, projectRootFolder: data.value }))}
                contentBefore={<FolderRegular />}
              />
              <Button appearance="secondary" onClick={selectFolder}>
                폴더 선택
              </Button>
            </div>
          </Field>

          <Field label="기본 프로젝트 이름" hint="새 프로젝트 생성 시 기본으로 사용될 이름입니다.">
            <Input
              value={settings.defaultProjectName}
              onChange={(_, data) => setSettings((prev) => ({ ...prev, defaultProjectName: data.value }))}
              contentBefore={<DocumentRegular />}
              placeholder="프로젝트 이름을 입력하세요"
            />
          </Field>
        </div>

        <div style={{ marginBottom: tokens.spacingVerticalL }}>
          <Text weight="semibold" style={{ marginBottom: tokens.spacingVerticalS }}>
            📁 자동 생성 폴더 구조
          </Text>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: tokens.spacingHorizontalS }}>
            {['scripts/', 'audio/', 'images/', 'output/', 'temp/'].map((folder) => (
              <Badge key={folder} appearance="outline" style={{ textAlign: "center" }}>
                {folder}
              </Badge>
            ))}
          </div>
        </div>

        <div className={settingsStyles.infoBox} style={{ marginBottom: tokens.spacingVerticalL }}>
          <div className={settingsStyles.infoIcon}>
            <InfoRegular />
          </div>
          <div className={settingsStyles.infoContent}>
            <Text size={300} weight="semibold" style={{ marginBottom: tokens.spacingVerticalS }}>
              프로젝트 폴더 구조 예시
            </Text>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, lineHeight: 1.4, fontFamily: "monospace" }}>
              📁 {settings.projectRootFolder}
              <br />
              └── 📁 {new Date().toISOString().split('T')[0]}/
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;└── 📁 {settings.defaultProjectName}-{new Date().toISOString().replace(/[:.]/g, '-')}/
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📁 scripts/ (대본 파일)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📁 audio/ (음성 파일)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📁 images/ (이미지 파일)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📁 output/ (최종 영상)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📁 temp/ (임시 파일)
            </Caption1>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div style={{ display: "flex", gap: "16px" }}>
          <Button 
            appearance="primary" 
            icon={<SaveRegular />} 
            onClick={saveSettings}
            disabled={!isModified}
          >
            설정 저장
          </Button>
          <Button appearance="secondary" icon={<ArrowResetRegular />} onClick={resetSettings}>
            기본값으로 초기화
          </Button>
        </div>
      </Card>
    </div>
  );
}