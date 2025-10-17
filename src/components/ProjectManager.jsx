import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Text, Button, Field, Input, Card, Caption1, tokens, Badge, Spinner, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent } from "@fluentui/react-components";
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
} from "@fluentui/react-icons";
import { useContainerStyles, useSettingsStyles, useHeaderStyles } from "../styles/commonStyles";
import { showGlobalToast } from "./common/GlobalToast";
import { useApi } from "../hooks/useApi";

/**
 * ProjectManager 컴포넌트
 *
 * @description
 * 새 프로젝트 생성 및 관리를 위한 컴포넌트입니다.
 * 영상 생성 프로젝트를 체계적으로 관리하고,
 * 프로젝트별 폴더 구조를 자동으로 생성합니다.
 *
 * @features
 * - 프로젝트 생성, 삭제, 목록 조회
 * - 자동 폴더 구조 생성 (scripts, audio, images, output, temp)
 * - 현재 활성 프로젝트 관리
 * - 프로젝트 출력 폴더 빠른 열기
 * - 프로젝트 경로 설정 관리
 *
 * @ipc_apis
 * 📁 프로젝트 관리 APIs (electron/ipc/projectManager.js):
 * - project:list - 프로젝트 목록 조회 (line 24)
 * - project:current - 현재 활성 프로젝트 조회 (line 50)
 * - project:create - 새 프로젝트 생성 (line 13)
 * - project:delete - 프로젝트 삭제 (line 61)
 * - project:load - 프로젝트 로드 (line 35)
 * - project:openOutputFolder - 프로젝트 출력 폴더 열기 (line 72)
 *
 * ⚙️ 설정 관리 APIs:
 * - window.api.getSetting(key) - 설정값 조회
 * - window.api.setSetting({key, value}) - 설정값 저장
 *
 * 📂 파일/폴더 APIs (electron/ipc/file-pickers.js):
 * - dialog:selectFolder - 폴더 선택 대화상자 (line 27)
 *
 * @author Weaver Pro Team
 * @version 2.0.0
 */

/**
 * 기본 프로젝트 설정 상수
 * @type {Object}
 * @property {string} projectRootFolder - 기본 프로젝트 루트 폴더 경로
 * @property {string} defaultProjectName - 기본 프로젝트 이름
 */
const DEFAULT_PROJECT_SETTINGS = {
  projectRootFolder: "", // 빈 문자열로 초기화 (electron에서 설정됨)
  defaultProjectName: "",
};

/**
 * 자동 생성될 폴더 구조 상수
 * @type {string[]}
 */
const FOLDER_STRUCTURE = ["scripts/", "audio/", "images/", "video/", "output/", "temp/"];

/**
 * 프로젝트 전체 경로에서 루트 폴더 경로만 추출
 * @param {string} fullPath - 프로젝트 전체 경로 (예: C:\Projects\MyProject)
 * @returns {string} 루트 폴더 경로 (예: C:\Projects)
 */
const getProjectRootPath = (fullPath) => {
  if (!fullPath) return "";
  const separatorIndex = Math.max(
    fullPath.lastIndexOf('\\'),
    fullPath.lastIndexOf('/')
  );
  return fullPath.substring(0, separatorIndex);
};

/**
 * ProjectManager 컴포넌트 - 프로젝트 생성 및 관리
 *
 * @returns {JSX.Element} ProjectManager 컴포넌트
 */
export default function ProjectManager() {
  // Fluent UI 스타일 훅
  const containerStyles = useContainerStyles();
  const settingsStyles = useSettingsStyles();
  const headerStyles = useHeaderStyles();
  const api = useApi();

  // 프로젝트 설정 상태 관리
  const [settings, setSettings] = useState({...DEFAULT_PROJECT_SETTINGS, videoSaveFolder: ""});
  const [isModified, setIsModified] = useState(false);
  const [originalSettings, setOriginalSettings] = useState({...DEFAULT_PROJECT_SETTINGS, videoSaveFolder: ""});

  // 프로젝트 목록 상태 관리
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  // 새 프로젝트 생성 상태 관리
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectTopic, setNewProjectTopic] = useState("");
  const [creating, setCreating] = useState(false);

  // 삭제 확인 다이얼로그 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  /**
   * 컴포넌트 마운트 시 초기 데이터 로드
   */
  useEffect(() => {
    loadSettings();
    loadProjects();
    loadCurrentProject();
  }, []);

  /**
   * 설정 수정 사항 감지 및 저장 버튼 활성화 상태 업데이트 (성능 최적화 - 필드 비교 사용)
   */
  const isModifiedMemo = useMemo(() => {
    return settings.projectRootFolder !== originalSettings.projectRootFolder ||
           settings.defaultProjectName !== originalSettings.defaultProjectName ||
           settings.videoSaveFolder !== originalSettings.videoSaveFolder;
  }, [settings, originalSettings]);

  useEffect(() => {
    setIsModified(isModifiedMemo);
  }, [isModifiedMemo]);

  /**
   * 프로젝트 목록과 현재 프로젝트 정보를 새로고침하는 통합 함수 (크래시 방지)
   */
  const refreshProjectData = useCallback(async () => {
    try {
      await Promise.all([loadProjects(), loadCurrentProject()]);
      // 프로젝트 삭제 후 설정이 백엔드에서 업데이트되었으므로 최신 설정 다시 로드
      await loadSettings();
    } catch (error) {
      console.error("프로젝트 데이터 새로고침 실패:", error);
      // 에러가 발생해도 앱이 죽지 않도록 처리
      showGlobalToast({
        type: "error",
        text: "데이터 업데이트 중 오류가 발생했습니다.",
      });
    }
  }, []);

  /**
   * 프로젝트 설정 변경을 다른 컴포넌트에 알리는 전역 이벤트 발생 함수 (크래시 방지)
   * @param {string} projectRootFolder - 프로젝트 루트 폴더 경로
   * @param {string} defaultProjectName - 기본 프로젝트 이름
   */
  const dispatchProjectSettingsUpdate = useCallback((projectRootFolder, defaultProjectName) => {
    try {
      // null/undefined 값 방어
      if (!projectRootFolder || !defaultProjectName) {
        console.warn("잘못된 프로젝트 설정 값으로 인한 이벤트 발생 차단");
        return;
      }

      window.dispatchEvent(
        new CustomEvent("projectSettings:updated", {
          detail: {
            projectRootFolder: String(projectRootFolder || ""),
            defaultProjectName: String(defaultProjectName || ""),
          },
        })
      );
    } catch (error) {
      console.error("전역 이벤트 발생 실패:", error);
      // 에러가 발생해도 앱이 죽지 않도록 처리
    }
  }, []);

  /**
   * 전역 설정에서 프로젝트 관련 설정값들을 로드 (크래시 방지)
   */
  const loadSettings = async () => {
    try {
      // API 호출 실패 시에도 기본값으로 동작
      let projectRootFolder, defaultProjectName, videoSaveFolder;

      try {
        projectRootFolder = await window?.api?.getSetting?.("projectRootFolder");
      } catch (err) {
        console.warn("프로젝트 루트 폴더 설정 로드 실패:", err);
        projectRootFolder = DEFAULT_PROJECT_SETTINGS.projectRootFolder;
      }

      try {
        defaultProjectName = await window?.api?.getSetting?.("defaultProjectName");
      } catch (err) {
        console.warn("기본 프로젝트 이름 설정 로드 실패:", err);
        defaultProjectName = DEFAULT_PROJECT_SETTINGS.defaultProjectName;
      }

      try {
        videoSaveFolder = await window?.api?.getSetting?.("videoSaveFolder");
      } catch (err) {
        console.warn("영상 저장 폴더 설정 로드 실패:", err);
        videoSaveFolder = "";
      }

      const loadedSettings = {
        projectRootFolder: projectRootFolder || DEFAULT_PROJECT_SETTINGS.projectRootFolder,
        defaultProjectName: defaultProjectName || DEFAULT_PROJECT_SETTINGS.defaultProjectName,
        videoSaveFolder: videoSaveFolder || "",
      };

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
    } catch (error) {
      console.error("프로젝트 설정 로드 실패:", error);
      // 에러 발생 시에도 기본값으로 동작
      const defaultWithVideo = {...DEFAULT_PROJECT_SETTINGS, videoSaveFolder: ""};
      setSettings(defaultWithVideo);
      setOriginalSettings(defaultWithVideo);
    }
  };

  /**
   * 전체 프로젝트 목록을 서버에서 로드 (크래시 방지)
   */
  const loadProjects = async () => {
    setLoading(true);
    try {
      // API 호출 안전성 검사
      if (!api?.invoke) {
        throw new Error("API 객체가 초기화되지 않았습니다.");
      }

      const result = await api.invoke("project:list");

      if (result?.success) {
        // 안전한 배열 처리
        const projects = Array.isArray(result.data?.projects)
          ? result.data.projects
          : Array.isArray(result.projects)
          ? result.projects
          : [];
        setProjects(projects);

        // 현재 프로젝트가 있으면 설정 업데이트
        if (projects.length > 0) {
          const currentProj = projects[0]; // 가장 최신 프로젝트
          const projectRootPath = getProjectRootPath(currentProj.paths.root);

          // 설정 업데이트
          const newSettings = {
            projectRootFolder: projectRootPath,
            defaultProjectName: currentProj.topic,
            videoSaveFolder: currentProj.paths.root,
          };
          setSettings(newSettings);
          setOriginalSettings(newSettings);

          console.log("✅ 프로젝트 목록 로드 후 설정 업데이트 완료");
        } else {
          // 프로젝트가 없을 때: 설정 초기화
          const currentRootFolder = await window?.api?.getSetting?.("projectRootFolder") || "";
          const emptySettings = {
            projectRootFolder: currentRootFolder,
            defaultProjectName: "",  // 빈 문자열로 초기화
            videoSaveFolder: "",     // 빈 문자열로 초기화
          };
          setSettings(emptySettings);
          setOriginalSettings(emptySettings);

          console.log("✅ 모든 프로젝트 삭제됨 - 설정 초기화 완료");
        }
      } else {
        console.error("프로젝트 목록 로드 실패:", result?.message || "알 수 없는 오류");
        setProjects([]); // 빈 배열로 설정하여 크래시 방지
      }
    } catch (error) {
      console.error("프로젝트 목록 로드 오류:", error);
      setProjects([]); // 에러 발생 시 빈 배열로 설정
    } finally {
      setLoading(false);
    }
  };

  /**
   * 현재 활성 프로젝트 정보를 로드 (크래시 방지)
   */
  const loadCurrentProject = async () => {
    try {
      // API 호출 안전성 검사
      if (!api?.invoke) {
        console.warn("API 객체가 사용할 수 없습니다.");
        return;
      }

      const result = await api.invoke("project:current");
      if (result?.success && result?.project) {
        setCurrentProject(result.project);
      } else {
        setCurrentProject(null); // 안전한 null 설정
      }
    } catch (error) {
      console.error("현재 프로젝트 로드 오류:", error);
      setCurrentProject(null); // 에러 시 null로 설정하여 크래시 방지
    }
  };

  /**
   * 현재 설정된 프로젝트 설정을 전역 설정에 저장 (병렬화 - 성능 개선)
   */
  const saveSettings = async () => {
    try {
      // 모든 설정을 병렬로 저장 (순차 처리 대신)
      await Promise.all([
        window.api.setSetting({
          key: "projectRootFolder",
          value: settings.projectRootFolder,
        }),
        window.api.setSetting({
          key: "defaultProjectName",
          value: settings.defaultProjectName,
        }),
        window.api.setSetting({
          key: "videoSaveFolder",
          value: settings.videoSaveFolder,
        }),
      ]);

      setOriginalSettings(settings);

      // 설정 페이지에도 반영되도록 전역 이벤트 발생
      dispatchProjectSettingsUpdate(settings.projectRootFolder, settings.defaultProjectName);

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

  /**
   * 프로젝트 설정을 기본값으로 초기화
   */
  const resetSettings = async () => {
    const defaultWithVideo = {...DEFAULT_PROJECT_SETTINGS, videoSaveFolder: ""};
    setSettings(defaultWithVideo);
    // 선택된 프로젝트 초기화
    setSelectedProject(null);
    // 강제로 originalSettings를 다른 값으로 설정해서 isModified가 true가 되도록 함
    setOriginalSettings({
      projectRootFolder: "temp_different_value",
      defaultProjectName: "temp_different_value",
      videoSaveFolder: "temp_different_value",
    });

    showGlobalToast({
      type: "success",
      text: "기본값으로 초기화되었습니다. 저장 버튼을 눌러 적용하세요.",
    });
  };

  /**
   * 새로운 프로젝트를 생성하고 필요한 폴더 구조를 자동 생성
   */
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
      const result = await api.invoke("project:create", {
        topic: newProjectTopic.trim(),
        options: {},
      });

      if (result.success) {
        showGlobalToast({
          type: "success",
          text: `프로젝트 "${newProjectTopic}"가 생성되었습니다!`,
        });
        setNewProjectTopic("");
        setShowCreateForm(false);

        // 프로젝트 생성 완료 이벤트 발생 (App.jsx에서 감지)
        window.dispatchEvent(new CustomEvent("project:created"));

        // 프로젝트 생성 후 경로 자동 저장 (백엔드에서도 자동 저장되므로 UI만 업데이트)
        try {
          const createdProject = result.project;
          if (createdProject?.topic && createdProject?.paths?.root) {
            const projectRootPath = getProjectRootPath(createdProject.paths.root);

            // 설정 상태 업데이트
            const newSettings = {
              projectRootFolder: projectRootPath,
              defaultProjectName: createdProject.topic,
              videoSaveFolder: createdProject.paths.root,
            };
            setSettings(newSettings);
            setOriginalSettings(newSettings);

            console.log("✅ 프로젝트 설정 상태 업데이트 완료 (백엔드에서 자동 저장됨)");
          }
        } catch (saveError) {
          console.warn("프로젝트 경로 자동 저장 중 경고:", saveError.message);
          // 경로 저장 실패해도 프로젝트 생성은 성공한 것으로 처리
        }

        await refreshProjectData();
      } else {
        console.error("프로젝트 생성 실패:", result.message);
        showGlobalToast({
          type: "error",
          text: `프로젝트 생성 실패: ${result.message}`,
        });
      }
    } catch (error) {
      console.error("프로젝트 생성 오류:", error);
      showGlobalToast({
        type: "error",
        text: "프로젝트 생성에 실패했습니다.",
      });
    } finally {
      setCreating(false);
    }
  };

  /**
   * 프로젝트 삭제 함수 (크래시 방지)
   * @param {string} projectId - 삭제할 프로젝트 ID
   */
  const deleteProject = async (projectId) => {
    try {
      // 입력값 검증
      if (!projectId) {
        console.error("삭제할 프로젝트 ID가 없습니다.");
        return;
      }


      // API 호출 안전성 검사
      if (!api?.invoke) {
        throw new Error("API가 사용할 수 없습니다.");
      }

      const result = await api.invoke("project:delete", projectId);

      if (result.success) {
        showGlobalToast({
          type: "success",
          text: "프로젝트가 삭제되었습니다.",
        });

        // 프로젝트 삭제 완료 이벤트 발생 (App.jsx에서 감지)
        window.dispatchEvent(new CustomEvent("project:deleted"));

        // 프로젝트 데이터 새로고침 후 설정 자동 반영
        await refreshProjectData();

        // 포커스 리셋 (한 번만 시도, 최소 딜레이)
        setTimeout(() => {
          document.activeElement?.blur?.();
        }, 100);
      } else {
        console.error("프로젝트 삭제 실패:", result.message);
        showGlobalToast({
          type: "error",
          text: `프로젝트 삭제 실패: ${result.message}`,
        });
      }
    } catch (error) {
      console.error("프로젝트 삭제 오류:", error);
      showGlobalToast({
        type: "error",
        text: "프로젝트 삭제에 실패했습니다.",
      });
      // 에러 발생 시에도 앱이 죽지 않도록 처리
    }
  };

  /**
   * 현재 프로젝트 폴더를 시스템 파일 탐색기로 열기
   */
  const openOutputFolder = async () => {
    try {
      const result = await api.invoke("project:openOutputFolder");
      if (result.success) {
        showGlobalToast({
          type: "success",
          text: "프로젝트 폴더를 열었습니다.",
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

  // UI 레이아웃을 위한 스타일 상수
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
        <div className={headerStyles.pageDescription}>새 프로젝트 생성 및 관리 - 영상 생성 프로젝트를 체계적으로 관리합니다.</div>
        <div className={headerStyles.divider} />
      </div>

      {/* 현재 활성 프로젝트 */}
      {currentProject && (
        <Card
          style={{ marginBottom: sectionGap, padding: tokens.spacingVerticalL, backgroundColor: tokens.colorPaletteLightGreenBackground1 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Text size={400} weight="semibold" style={{ display: "block", marginBottom: tokens.spacingVerticalXS }}>
                📁 현재 활성 프로젝트
              </Text>
              <Text size={300}>
                {currentProject?.topic || "이름 없음"} ({currentProject?.id || "Unknown"})
              </Text>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                생성일: {currentProject?.createdAt ? new Date(currentProject.createdAt).toLocaleString() : "알 수 없음"}
              </Caption1>
            </div>
            <Button appearance="primary" icon={<FolderOpenRegular />} onClick={openOutputFolder}>
              폴더 열기
            </Button>
          </div>
        </Card>
      )}

      {/* 새 프로젝트 생성 */}
      <Card style={{ marginBottom: sectionGap, padding: tokens.spacingVerticalM }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showCreateForm ? tokens.spacingVerticalM : 0 }}>
          <Text size={400} weight="semibold">
            🆕 새 프로젝트 생성
          </Text>
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => {
              if (!showCreateForm) {
                // 폼을 열 때 상태 초기화
                setNewProjectTopic("");
                setCreating(false);
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
                value={newProjectTopic}
                onChange={(_, data) => setNewProjectTopic(data.value)}
                placeholder="예: 유튜브 마케팅 전략, 요리 레시피 소개 등"
                contentBefore={<DocumentRegular />}
                disabled={creating}
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
              <Button appearance="secondary" onClick={() => setShowCreateForm(false)}>
                취소
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 프로젝트 목록 */}
      <Card style={{ marginBottom: sectionGap, padding: tokens.spacingVerticalL }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.spacingVerticalM }}>
          <Text size={400} weight="semibold">
            📋 프로젝트 목록
          </Text>
          <Button appearance="secondary" onClick={loadProjects} disabled={loading} icon={loading ? <Spinner size="tiny" /> : undefined}>
            새로고침
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: tokens.spacingVerticalXXL }}>
            <Spinner size="medium" />
            <Text style={{ marginTop: tokens.spacingVerticalM }}>프로젝트 목록을 불러오는 중...</Text>
          </div>
        ) : projects.length === 0 ? (
          <Card style={{
            padding: tokens.spacingVerticalM,
            backgroundColor: tokens.colorPaletteBlueBackground1,
            border: `1px solid ${tokens.colorPaletteBlueBorderActive}`
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <InfoRegular style={{ color: tokens.colorPaletteBlueForeground1 }} />
              <Text>
                생성된 프로젝트가 없습니다. 새 프로젝트를 생성해보세요.
              </Text>
            </div>
          </Card>
        ) : (
          <div style={{ display: "grid", gap: tokens.spacingVerticalM }}>
            {(Array.isArray(projects) ? projects : []).map((project) => (
              <Card
                key={project.id}
                style={{
                  padding: tokens.spacingVerticalM,
                  backgroundColor: selectedProject?.id === project.id ? tokens.colorBrandBackground2 : tokens.colorNeutralBackground2,
                  cursor: "pointer",
                  border:
                    selectedProject?.id === project.id
                      ? `2px solid ${tokens.colorBrandStroke1}`
                      : `1px solid ${tokens.colorNeutralStroke2}`,
                }}
                onClick={() => {
                  setSelectedProject(project);
                  // 프로젝트 선택 시 백엔드의 현재 프로젝트로 설정 (폴더 열기 시에만 로드)
                  // 프로젝트 경로 설정의 "기본 프로젝트 이름"은 현재 활성 프로젝트만 표시하도록 변경
                  // 따라서 선택 시 settings 업데이트 없음 (UI 혼동 방지)
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <Text weight="semibold">{project?.topic || "이름 없음"}</Text>
                      {currentProject?.id === project.id && (
                        <Badge appearance="filled" color="success" icon={<CheckmarkCircleRegular />}>
                          활성
                        </Badge>
                      )}
                      {selectedProject?.id === project.id && (
                        <Badge appearance="filled" color="brand">
                          선택됨
                        </Badge>
                      )}
                    </div>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>ID: {project?.id || "Unknown"}</Caption1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      생성일: {project?.createdAt ? new Date(project.createdAt).toLocaleString() : "알 수 없음"}
                    </Caption1>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Button
                      appearance="subtle"
                      icon={<FolderOpenRegular />}
                      size="small"
                      onClick={async (e) => {
                        e.stopPropagation(); // 이벤트 버블링 방지
                        try {
                          // 안전한 비동기 처리로 크래시 방지
                          if (!api?.invoke) {
                            throw new Error("API가 사용할 수 없습니다.");
                          }

                          if (!project?.id) {
                            throw new Error("유효하지 않은 프로젝트 ID입니다.");
                          }

                          const result = await api.invoke("project:load", project.id);
                          if (result?.success) {
                            await openOutputFolder();
                          } else {
                            console.error("프로젝트 로드 실패:", result?.message);
                          }
                        } catch (error) {
                          console.error("폴더 열기 오류:", error);
                          // 에러가 발생해도 앱이 죽지 않도록 처리
                        }
                      }}
                    >
                      폴더 열기
                    </Button>
                    <Button
                      appearance="subtle"
                      icon={<DeleteRegular />}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation(); // 이벤트 버블링 방지
                        // 버튼에서 포커스 제거
                        e.currentTarget.blur();
                        // project.id 안전성 검사
                        if (project?.id) {
                          setProjectToDelete(project.id);
                          setDeleteDialogOpen(true);
                        } else {
                          console.error("삭제할 프로젝트 ID가 없습니다.");
                        }
                      }}
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
          size={400}
          weight="semibold"
          style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: tokens.spacingVerticalM }}
        >
          <FolderRegular /> 현재 프로젝트 경로
        </Text>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: itemGap, marginBottom: tokens.spacingVerticalL }}>
          <Field label="프로젝트 루트 폴더" hint="모든 프로젝트가 저장되는 기본 폴더입니다.">
            <Input
              value={settings.projectRootFolder}
              contentBefore={<FolderRegular style={{ color: tokens.colorBrandForeground1 }} />}
              placeholder="예: C:\\WeaverPro"
              disabled={true}
              input={{ style: { color: tokens.colorBrandForeground1 } }}
            />
          </Field>

          <Field label="현재 활성 프로젝트" hint="현재 작업 중인 프로젝트명입니다.">
            <Input
              value={currentProject?.topic || settings.defaultProjectName || "활성 프로젝트 없음"}
              contentBefore={<CheckmarkCircleRegular style={{ color: tokens.colorBrandForeground1 }} />}
              placeholder="프로젝트 선택 후 표시됩니다"
              disabled={true}
              input={{ style: { color: tokens.colorBrandForeground1 } }}
            />
          </Field>
        </div>

        <div style={{ marginBottom: tokens.spacingVerticalL }}>
          <Text weight="semibold" style={{ marginBottom: tokens.spacingVerticalS }}>
            📁 자동 생성 폴더 구조
          </Text>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: tokens.spacingHorizontalS }}>
            {FOLDER_STRUCTURE.map((folder) => (
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
              └── 📁 {currentProject?.topic || settings.defaultProjectName || "프로젝트명"}/
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;├── 📁 scripts/ (대본 파일)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;├── 📁 audio/ (음성 파일)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;├── 📁 images/ (이미지 파일)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;├── 📁 video/ (다운로드된 영상)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;├── 📁 output/ (최종 영상)
              <br />
              &nbsp;&nbsp;&nbsp;&nbsp;└── 📁 temp/ (임시 파일)
            </Caption1>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div style={{ display: "flex", gap: "16px" }}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={saveSettings} disabled={!isModified}>
            설정 저장
          </Button>
          <Button appearance="secondary" icon={<ArrowResetRegular />} onClick={resetSettings}>
            기본값으로 초기화
          </Button>
        </div>
      </Card>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={(e, data) => setDeleteDialogOpen(data.open)}>
        <DialogSurface style={{ maxWidth: '480px' }}>
          <DialogBody>
            <DialogTitle style={{ fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold }}>
              ⚠️ 프로젝트 삭제
            </DialogTitle>
            <DialogContent style={{ paddingTop: tokens.spacingVerticalM, paddingBottom: tokens.spacingVerticalL }}>
              <Text style={{ display: 'block', marginBottom: tokens.spacingVerticalS }}>
                정말로 이 프로젝트를 삭제하시겠습니까?
              </Text>
              <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                이 작업은 되돌릴 수 없습니다. 프로젝트의 모든 파일과 데이터가 영구적으로 삭제됩니다.
              </Caption1>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setProjectToDelete(null);
                }}
              >
                취소
              </Button>
              <Button
                appearance="primary"
                style={{
                  backgroundColor: tokens.colorPaletteRedBackground3,
                  color: tokens.colorNeutralForegroundOnBrand,
                  borderColor: tokens.colorPaletteRedBorder2
                }}
                icon={<DeleteRegular />}
                onClick={() => {
                  setDeleteDialogOpen(false);
                  if (projectToDelete) {
                    deleteProject(projectToDelete);
                    setProjectToDelete(null);
                  }
                }}
              >
                삭제하기
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
