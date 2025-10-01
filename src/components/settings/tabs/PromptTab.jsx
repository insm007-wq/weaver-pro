import React, { useState, useEffect, useRef, useCallback } from "react";
import { Text, Button, Dropdown, Option, Field, Input, Textarea, Card, tokens, TabList, Tab } from "@fluentui/react-components";
import {
  AddRegular,
  DeleteRegular,
  SaveRegular,
  ArrowResetRegular,
  DocumentTextRegular,
  DismissCircleRegular,
  EditRegular,
  BrainCircuitRegular,
  ShieldCheckmarkRegular,
} from "@fluentui/react-icons";
import { useApi } from "../../../hooks/useApi";
import { LoadingSpinner } from "../../common/LoadingSpinner";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { showGlobalToast } from "../../common/GlobalToast";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { DEFAULT_GENERATE_PROMPT, DEFAULT_REFERENCE_PROMPT, DEFAULT_TEMPLATE } from "../../../constants/prompts";

/**
 * PromptTab 컴포넌트
 *
 * @description
 * AI 프롬프트 템플릿을 관리하는 설정 탭 컴포넌트입니다.
 * 대본 생성과 레퍼런스 분석에 사용할 프롬프트를 생성, 편집, 삭제하고
 * 모든 프롬프트 데이터를 전역 설정 파일(settings.json)에 저장합니다.
 *
 * @features
 * - 프롬프트 CRUD: 생성, 읽기, 수정, 삭제
 * - 카테고리별 관리: 대본 생성/레퍼런스 분석 프롬프트 분리
 * - 실시간 편집: 텍스트 에디터로 프롬프트 직접 편집
 * - 템플릿 변수: {topic}, {duration}, {style} 등 지원
 * - 설정 저장: 전역 설정 파일 기반 데이터 저장
 * - 기본값 복원: 각 카테고리별 기본 프롬프트로 초기화
 *
 * @ipc_apis
 * 🧠 프롬프트 관리 APIs (electron/ipc/prompts.js):
 * - prompts:getAll - 모든 프롬프트 조회
 * - prompts:getPairByName - 이름으로 프롬프트 쌍 조회
 * - prompts:savePair - 프롬프트 쌍 저장 (script + reference)
 * - prompts:deleteByName - 이름으로 프롬프트 삭제
 *
 * ⚙️ 설정 관리 APIs (electron/services/store.js):
 * - window.api.getSetting("prompts") - 프롬프트 배열 조회
 * - window.api.setSetting({key: "prompts", value: []}) - 프롬프트 배열 저장
 *
 * @data_structure
 * settings.json에 저장되는 프롬프트 구조:
 * {
 *   "prompts": [
 *     {
 *       "id": "unique-id",
 *       "name": "프롬프트 이름",
 *       "category": "script" | "reference",
 *       "content": "프롬프트 내용",
 *       "isDefault": boolean,
 *       "createdAt": "ISO 날짜",
 *       "updatedAt": "ISO 날짜"
 *     }
 *   ]
 * }
 *
 * @template_variables
 * 대본 생성 프롬프트: {topic}, {duration}, {style}
 * 레퍼런스 분석 프롬프트: {referenceScript}, {topic}
 *
 * @author Weaver Pro Team
 * @version 2.0.0
 */

/* ================= 헬퍼 함수들 ================= */

/**
 * API 응답이 성공인지 확인하는 함수
 * @param {Object} res - API 응답 객체
 * @returns {boolean} 성공 여부
 */
const isOk = (res) => res?.ok === true || res?.success === true;

/**
 * 카테고리에 따른 기본 프롬프트 반환
 * @param {string} cat - 카테고리 ("script" | "reference")
 * @returns {string} 기본 프롬프트 텍스트
 */
const catDefault = (cat) => (cat === "script" ? DEFAULT_GENERATE_PROMPT : DEFAULT_REFERENCE_PROMPT);

/**
 * 기본 프롬프트 쌍 이름 상수
 */
const DEFAULT_PAIR_NAME = "기본프롬프트(기본)";

/**
 * 선택된 프롬프트가 기본 프롬프트인지 확인
 * @param {string} selectedName - 선택된 프롬프트 이름
 * @param {Array} prompts - 프롬프트 배열
 * @returns {boolean} 기본 프롬프트 여부
 */
const isDefaultPrompt = (selectedName, prompts) => {
  if (!selectedName) return false;

  // "기본 프롬프트"는 항상 기본 프롬프트로 간주
  if (selectedName === "기본 프롬프트") return true;

  if (!Array.isArray(prompts)) return false;
  return prompts.some((p) => p.name === selectedName && p.isDefault);
};

/**
 * 모든 프롬프트 이름들을 중복 제거하고 정렬하여 반환 (기본 프롬프트 포함)
 * @param {Array} list - 프롬프트 배열
 * @returns {Array} 고유한 프롬프트 이름 배열 (한국어 정렬, 기본 프롬프트 포함)
 */
const uniqueUserNames = (list) => {
  if (!Array.isArray(list)) {
    console.warn("[PromptTab] uniqueUserNames: list is not an array:", list);
    return [];
  }
  return Array.from(new Set(list.map((p) => p.name))) // 모든 프롬프트 포함 (기본 프롬프트도 포함)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ko"));
};

/* ================= 메인 컴포넌트 ================= */
function PromptTab() {
  // Fluent UI 스타일 훅
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const api = useApi();

  // 프롬프트 데이터 상태
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 에디터 상태
  const [scriptPrompt, setScriptPrompt] = useState("");
  const [referencePrompt, setReferencePrompt] = useState("");
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [originalThumbnailPrompt, setOriginalThumbnailPrompt] = useState("");

  // 선택된 프롬프트 상태
  const [selectedName, setSelectedName] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [selectedReferenceId, setSelectedReferenceId] = useState("");

  // UI 제어 상태
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedTab, setSelectedTab] = useState("script");
  const didInitRef = useRef(false);

  /* ============ 초기화 및 데이터 로드 ============ */

  /**
   * 컴포넌트 마운트 시 프롬프트 데이터 로드
   */
  useEffect(() => {
    loadPrompts();
    loadThumbnailPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 프롬프트 데이터 초기 로드 완료 후 상태 설정
   * 초기 로딩 시에만 실행되고, 이후 수동 상태 관리
   */
  useEffect(() => {
    if (!didInitRef.current && Array.isArray(prompts)) {
      // 기본 프롬프트들 찾기
      const dScript = prompts.find((p) => p.isDefault && p.category === "script");
      const dRef = prompts.find((p) => p.isDefault && p.category === "reference");

      // 에디터에 기본 프롬프트 설정
      setScriptPrompt(dScript?.content?.trim() ?? catDefault("script"));
      setReferencePrompt(dRef?.content?.trim() ?? catDefault("reference"));

      // 사용자 프롬프트가 있으면 첫 번째 사용자 프롬프트 선택, 없으면 기본 프롬프트 선택
      const userNames = uniqueUserNames(prompts);

      if (userNames.length > 0) {
        // 사용자 프롬프트가 있으면 첫 번째 사용자 프롬프트 선택
        activatePair(userNames[0]);
      } else {
        // 사용자 프롬프트가 없으면 기본 프롬프트 선택
        activatePair("기본 프롬프트");
      }

      didInitRef.current = true;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts]);

  /**
   * 전체 프롬프트 목록을 API에서 로드
   * prompts:getAll API를 호출하여 설정 파일에서 프롬프트 데이터 가져오기
   */
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

  /**
   * 썸네일 프롬프트를 settings.json에서 로드
   */
  const loadThumbnailPrompt = async () => {
    try {
      const savedTemplate = await window.api.getSetting("thumbnailPromptTemplate");
      const templateToUse = savedTemplate || DEFAULT_TEMPLATE;
      setThumbnailPrompt(templateToUse);
      setOriginalThumbnailPrompt(templateToUse);
    } catch (error) {
      console.error("썸네일 프롬프트 로드 실패:", error);
      setThumbnailPrompt(DEFAULT_TEMPLATE);
      setOriginalThumbnailPrompt(DEFAULT_TEMPLATE);
    }
  };

  /* ============ 프롬프트 쌍 로드/저장 헬퍼 함수들 ============ */

  /**
   * 특정 이름의 프롬프트 쌍을 활성화하여 에디터에 로드
   * @param {string} name - 프롬프트 쌍 이름
   */
  const activatePair = async (name) => {
    try {
      setSelectedName(name);

      // "기본 프롬프트"도 다른 프롬프트와 동일하게 API로 로드

      const res = await api.invoke("prompts:getPairByName", name);
      if (!isOk(res)) throw new Error(res?.message || "load failed");

      const { script, reference } = res.data || {};

      // 프롬프트 ID 설정
      setSelectedScriptId(script?.id || "");
      setSelectedReferenceId(reference?.id || "");

      // 에디터에 프롬프트 내용 설정
      if (script) setScriptPrompt(script.content?.trim() ?? "");
      if (reference) setReferencePrompt(reference.content?.trim() ?? "");

      // 기본 프롬프트 쌍인 경우 기본값으로 설정
      if (!script && !reference && name === DEFAULT_PAIR_NAME) {
        setScriptPrompt(catDefault("script"));
        setReferencePrompt(catDefault("reference"));
      }
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * 프롬프트 쌍을 저장 (대본 생성 + 레퍼런스 분석 프롬프트)
   * @param {string} name - 프롬프트 쌍 이름
   * @param {string} scriptText - 대본 생성 프롬프트 내용
   * @param {string} referenceText - 레퍼런스 분석 프롬프트 내용
   * @returns {Object} API 응답 결과
   */
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

      // 저장된 프롬프트 ID 가져오기
      const sId = res.data?.script?.id || "";
      const rId = res.data?.reference?.id || "";

      // 프롬프트 목록 새로고침
      await loadPrompts();

      // UI 상태 업데이트
      setSelectedName(nm);
      setSelectedScriptId(sId);
      setSelectedReferenceId(rId);

      // 에디터 내용 업데이트
      setScriptPrompt(res.data?.script?.content ?? "");
      setReferencePrompt(res.data?.reference?.content ?? "");

      setIsSaving(false);
      return res;
    } catch (e) {
      setIsSaving(false);
      throw e;
    }
  };


  /* ============ 드롭다운 옵션 ============ */

  /**
   * 사용자 정의 프롬프트 이름 목록 (메모이제이션)
   * 프롬프트 배열이 변경될 때만 재계산
   */
  const nameOptions = React.useMemo(() => {
    if (!Array.isArray(prompts)) {
      console.warn("[PromptTab] prompts is not an array in useMemo:", prompts);
      return ["기본 프롬프트"]; // 빈 배열이어도 기본 프롬프트는 항상 포함
    }

    const userNames = uniqueUserNames(prompts);

    // 기본 프롬프트가 없으면 항상 추가 (맨 앞에 표시)
    if (!userNames.includes("기본 프롬프트")) {
      userNames.unshift("기본 프롬프트");
    }

    return userNames;
  }, [prompts]);

  /* ============ CRUD 기능들 ============ */

  /**
   * 인라인 프롬프트 생성 처리
   * 새 이름으로 기본 프롬프트 쌍을 생성
   */
  const handleCreateInline = async () => {
    const base = newName.trim();
    if (!base) {
      showGlobalToast({
        type: "warning",
        text: "프롬프트 이름을 입력해주세요.",
      });
      return;
    }

    try {
      await savePair(base, catDefault("script"), catDefault("reference"));
      setShowInlineCreate(false);
      setNewName("");

      showGlobalToast({
        type: "success",
        text: "프롬프트가 생성되었습니다.",
      });
    } catch (e) {
      console.error(e);
      showGlobalToast({
        type: "error",
        text: "프롬프트 생성에 실패했습니다.",
      });
    }
  };

  /**
   * 선택된 프롬프트 쌍 삭제
   * 기본 프롬프트는 삭제할 수 없음
   */
  const handleDelete = async () => {
    try {
      if (!selectedName) {
        showGlobalToast({
          type: "warning",
          text: "삭제할 프롬프트를 선택해주세요.",
        });
        return;
      }

      // 기본 프롬프트인지 확인
      if (isDefaultPrompt(selectedName, prompts)) {
        showGlobalToast({
          type: "warning",
          text: "기본 프롬프트는 삭제할 수 없습니다.",
        });
        return;
      }

      const res = await api.invoke("prompts:deleteByName", selectedName);
      if (!isOk(res)) {
        showGlobalToast({
          type: "error",
          text: res?.message || "삭제 실패",
        });
        return;
      }

      // 삭제 이후 직접 상태를 관리 (useEffect 자동 호출 방지)
      const updated = prompts.filter(p => p.name !== selectedName);
      setPrompts(updated);  // prompts 업데이트 → 자동으로 UI 갱신됨

      const remainingNames = uniqueUserNames(updated);
      const allNames = remainingNames.length === 0 ? ["기본 프롬프트"] : remainingNames;

      if (allNames.length > 0) {
        await activatePair(allNames[0]);
      } else {
        // 프롬프트가 하나도 없으면 기본값으로 세팅
        setSelectedName(DEFAULT_PAIR_NAME);
        setSelectedScriptId("");
        setSelectedReferenceId("");
        setScriptPrompt(catDefault("script"));
        setReferencePrompt(catDefault("reference"));
      }

      showGlobalToast({
        type: "success",
        text: "삭제되었습니다.",
      });
    } catch (e) {
      console.error(e);
      showGlobalToast({
        type: "error",
        text: "삭제 중 오류가 발생했습니다.",
      });
    }
  };

  /**
   * 현재 에디터의 프롬프트 내용을 저장
   * 유효한 프롬프트 이름이 있을 때만 저장 가능
   */
  const handleSaveAll = async () => {
    try {
      const name = selectedName;

      // 이름이 없는 경우
      if (!name) {
        showGlobalToast({
          type: "warning",
          text: "저장하려면 먼저 '새 프롬프트'를 생성하거나 기존 프롬프트를 선택해주세요.",
        });
        return;
      }

      // 기본 프롬프트도 수정 가능하도록 허용

      await savePair(name, scriptPrompt, referencePrompt);

      // 썸네일 프롬프트도 함께 저장
      await saveThumbnailPrompt();

      showGlobalToast({
        type: "success",
        text: "성공적으로 저장되었습니다! 🎉",
      });
    } catch (e) {
      console.error(e);
      showGlobalToast({
        type: "error",
        text: "저장 중 오류가 발생했습니다.",
      });
    }
  };

  /**
   * 썸네일 프롬프트를 settings.json에 저장
   */
  const saveThumbnailPrompt = async () => {
    try {
      if (!thumbnailPrompt || thumbnailPrompt.trim().length === 0) {
        throw new Error("빈 템플릿은 저장할 수 없습니다.");
      }

      await window.api.setSetting({
        key: "thumbnailPromptTemplate",
        value: thumbnailPrompt.trim(),
      });

      setOriginalThumbnailPrompt(thumbnailPrompt.trim());
    } catch (error) {
      console.error("썸네일 프롬프트 저장 실패:", error);
      throw error;
    }
  };

  /**
   * 특정 카테고리의 프롬프트를 기본값으로 초기화
   * @param {string} category - "script", "reference", "thumbnail"
   */
  const handleReset = (category) => {
    if (category === "script") setScriptPrompt(catDefault("script"));
    else if (category === "reference") setReferencePrompt(catDefault("reference"));
    else if (category === "thumbnail") setThumbnailPrompt(DEFAULT_TEMPLATE);

    showGlobalToast({
      type: "success",
      text: "프롬프트가 기본값으로 초기화되었습니다.",
    });
  };

  /* ============ 렌더링 ============ */

  // 프롬프트 글자 수 계산
  const scriptCount = scriptPrompt.length || 0;
  const referenceCount = referencePrompt.length || 0;
  const thumbnailCount = thumbnailPrompt.length || 0;

  // 로딩 중일 때 스피너 표시
  if (loading) {
    return (
      <div className={containerStyles.container}>
        <LoadingSpinner size="large" message="프롬프트를 로드하는 중..." />
      </div>
    );
  }

  return (
    <div className={containerStyles.container}>
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
                selectedOptions={
                  nameOptions.length > 0 && selectedName && nameOptions.includes(selectedName)
                    ? [selectedName]
                    : []
                }
                value={
                  nameOptions.length > 0
                    ? (selectedName && nameOptions.includes(selectedName) ? selectedName : "")
                    : ""
                }
                onOptionSelect={async (_, d) => {
                  const name = d?.optionValue;
                  if (name) await activatePair(name);
                }}
                placeholder={nameOptions.length > 0 ? "프롬프트를 선택하세요" : "먼저 '새 프롬프트'를 생성해주세요"}
                disabled={nameOptions.length === 0}
              >
                {nameOptions.length > 0 ? (
                  nameOptions.map((nm) => {
                    const isDefault = isDefaultPrompt(nm, prompts);
                    return (
                      <Option key={nm} value={nm} text={nm}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {isDefault && <ShieldCheckmarkRegular style={{ color: tokens.colorPaletteGoldForeground1, fontSize: 14 }} />}
                          <span>{nm}</span>
                        </div>
                      </Option>
                    );
                  })
                ) : (
                  <Option value="" disabled>
                    프롬프트가 없습니다. '새 프롬프트'를 생성해주세요.
                  </Option>
                )}
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

          {/* 관리 액션 버튼 - 새 프롬프트 생성 시 숨김 */}
          {!showInlineCreate && (
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
                disabled={!selectedName || !nameOptions.includes(selectedName) || isDefaultPrompt(selectedName, prompts)}
              >
                삭제
              </Button>
              <Button
                appearance="primary"
                icon={isSaving ? <LoadingSpinner size="tiny" /> : <SaveRegular />}
                onClick={handleSaveAll}
                disabled={isSaving || !scriptPrompt || !referencePrompt || !thumbnailPrompt || !selectedName}
              >
                {isSaving ? "저장 중..." : "저장하기"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ===== 탭 네비게이션 ===== */}
      <Card
        className={cardStyles.settingsCard}
        style={{
          boxShadow: tokens.shadow8,
          borderRadius: 12,
          padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXL}`,
          marginBottom: tokens.spacingVerticalM,
        }}
      >
        <TabList selectedValue={selectedTab} onTabSelect={(_, data) => setSelectedTab(data.value)}>
          <Tab value="script" icon={<EditRegular />}>
            대본 생성
          </Tab>
          <Tab value="reference" icon={<DocumentTextRegular />}>
            레퍼런스 분석
          </Tab>
          <Tab value="thumbnail" icon={<BrainCircuitRegular />}>
            썸네일 생성
          </Tab>
        </TabList>
      </Card>

      {/* ===== 에디터 영역 (단일 탭 패널) ===== */}
      <Card
        className={cardStyles.settingsCard}
        style={{
          boxShadow: tokens.shadow8,
          border: `1px solid ${tokens.colorNeutralStroke2}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 400px)",
        }}
      >
        {/* 대본 생성 탭 */}
        {selectedTab === "script" && (
          <>
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
              {scriptCount.toLocaleString()} 글자 | 변수: {"{topic}, {duration}, {style}, {totalSeconds}, {minSceneCount}, {maxSceneCount}, {targetSceneCount}, {minCharacters}, {maxCharacters}, {avgCharactersPerScene}"}
            </Text>
          </>
        )}

        {/* 레퍼런스 분석 탭 */}
        {selectedTab === "reference" && (
          <>
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
              {referenceCount.toLocaleString()} 글자 | 변수: {"{referenceText}, {topic}, {duration}, {totalSeconds}, {minSceneCount}, {maxSceneCount}"}
            </Text>
          </>
        )}

        {/* 썸네일 생성 탭 */}
        {selectedTab === "thumbnail" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: tokens.spacingVerticalM }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BrainCircuitRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
                <Text weight="semibold" size={500}>
                  썸네일 생성 프롬프트
                </Text>
              </div>
              <Button size="small" icon={<ArrowResetRegular />} onClick={() => handleReset("thumbnail")}>
                기본값
              </Button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              <Textarea
                value={thumbnailPrompt}
                onChange={(_, d) => setThumbnailPrompt(d.value)}
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
              {thumbnailCount.toLocaleString()} 글자 | 변수: {"{content}, {referenceAnalysis}"}
            </Text>
          </>
        )}
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
