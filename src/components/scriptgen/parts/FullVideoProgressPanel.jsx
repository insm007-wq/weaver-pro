/**
 * 전체 영상 생성 진행률 패널 컴포넌트
 *
 * @description
 * 자동화 모드와 대본 생성 모드의 전체 진행 상황을 시각적으로 표시하는 메인 패널
 * 각 단계별 진행률, 경과 시간, 로그, 완료 시 액션 버튼 등을 포함합니다.
 *
 * @features
 * - 🎯 모드별 단계 표시 (자동화: 4단계, 대본생성: 3단계)
 * - ⏱️ 실시간 경과 시간 표시
 * - 📋 진행 로그 실시간 업데이트
 * - 🎨 단계별 연결선 및 진행률 바
 * - 🎬 완료 시 출력 폴더 열기 / 영상 재생 버튼
 * - 🚫 진행 중 취소 버튼
 * - 🎨 상태별 배경색 변경 (진행중/완료/오류)
 *
 * @requires
 * - API: `project:openOutputFolder` - 출력 폴더 열기
 * - Component: ProgressStepComponent - 개별 단계 컴포넌트
 * - Icons: DocumentEditRegular, MicRegular, ImageRegular, VideoRegular, FolderOpenRegular, PlayRegular
 *
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React from "react";
import { Text, tokens, Button, Card, CardHeader } from "@fluentui/react-components";
import {
  DocumentEditRegular,
  VideoRegular,
  MicRegular,
  ImageRegular,
  FolderOpenRegular,
  PlayRegular,
} from "@fluentui/react-icons";
import ProgressStepComponent from "./ProgressStepComponent";

/**
 * 전체 영상 생성 진행률을 표시하는 패널 컴포넌트
 *
 * @component
 * @param {Object} props - 컴포넌트 props
 * @param {Object} props.fullVideoState - 전체 영상 생성 상태 객체
 * @param {boolean} props.fullVideoState.isGenerating - 현재 생성 진행 중 여부
 * @param {string} props.fullVideoState.currentStep - 현재 진행 단계 ("script"|"audio"|"images"|"video"|"subtitle"|"completed"|"error"|"idle")
 * @param {string} props.fullVideoState.mode - 실행 모드 ("automation_mode"|"script_mode"|"idle")
 * @param {Object} props.fullVideoState.progress - 각 단계별 진행률 (0-100)
 * @param {number} props.fullVideoState.progress.script - 대본 생성 진행률
 * @param {number} props.fullVideoState.progress.audio - 음성 생성 진행률
 * @param {number} props.fullVideoState.progress.images - 이미지 생성 진행률
 * @param {number} props.fullVideoState.progress.video - 영상 합성 진행률
 * @param {number} props.fullVideoState.progress.subtitle - 자막 생성 진행률
 * @param {Date} props.fullVideoState.startTime - 생성 시작 시간
 * @param {Array} props.fullVideoState.logs - 진행 로그 배열
 * @param {Object} props.fullVideoState.logs[].timestamp - 로그 시간
 * @param {string} props.fullVideoState.logs[].message - 로그 메시지
 * @param {string} props.fullVideoState.logs[].type - 로그 타입 ("info"|"success"|"error"|"warning")
 * @param {Object} props.fullVideoState.results - 생성 결과 객체
 * @param {Object} props.fullVideoState.results.video - 영상 파일 정보
 * @param {Function} props.resetFullVideoState - 상태 초기화 함수
 * @param {Function} props.api - API 호출 함수
 * @param {Object} props.toast - 토스트 알림 객체
 * @param {Function} props.toast.success - 성공 토스트 표시 함수
 * @param {Function} props.toast.error - 오류 토스트 표시 함수
 *
 * @example
 * ```jsx
 * // 기본 사용법
 * import FullVideoProgressPanel from './parts/FullVideoProgressPanel';
 * import { useToast } from '../../hooks/useToast';
 * import { useApi } from '../../hooks/useApi';
 *
 * function ScriptGenerator() {
 *   const [fullVideoState, setFullVideoState] = useState({
 *     isGenerating: false,
 *     currentStep: "idle",
 *     mode: "script_mode",
 *     progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
 *     startTime: null,
 *     logs: [],
 *     results: { script: null, audio: null, images: [], video: null }
 *   });
 *
 *   const toast = useToast();
 *   const api = useApi();
 *
 *   const resetFullVideoState = () => {
 *     setFullVideoState({
 *       isGenerating: false,
 *       mode: "idle",
 *       currentStep: "idle",
 *       progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
 *       results: { script: null, audio: null, images: [], video: null },
 *       startTime: null,
 *       logs: [],
 *     });
 *   };
 *
 *   return (
 *     <FullVideoProgressPanel
 *       fullVideoState={fullVideoState}
 *       resetFullVideoState={resetFullVideoState}
 *       api={api}
 *       toast={toast}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```jsx
 * // 자동화 모드에서 사용
 * const automationState = {
 *   isGenerating: true,
 *   currentStep: "audio",
 *   mode: "automation_mode",
 *   progress: { script: 100, audio: 65, images: 0, video: 0, subtitle: 0 },
 *   startTime: new Date(),
 *   logs: [
 *     { timestamp: "14:30:25", message: "대본 생성 완료", type: "success" },
 *     { timestamp: "14:30:45", message: "음성 생성 중... (2/5)", type: "info" }
 *   ],
 *   results: { script: {...}, audio: null, images: [], video: null }
 * };
 *
 * <FullVideoProgressPanel
 *   fullVideoState={automationState}
 *   resetFullVideoState={resetState}
 *   api={apiInstance}
 *   toast={toastInstance}
 * />
 * ```
 */
function FullVideoProgressPanel({ fullVideoState, resetFullVideoState, api, toast }) {
  // 생성이 진행중이지 않고 대기 상태면 패널을 표시하지 않음
  if (!fullVideoState.isGenerating && fullVideoState.currentStep === "idle") return null;

  // 모드별 단계 정의
  // 자동화 모드: 대본 생성 → 음성 생성 → 이미지 생성 → 영상 합성
  const automationSteps = [
    { key: "script", title: "대본 생성", icon: DocumentEditRegular },
    { key: "audio", title: "음성 생성", icon: MicRegular },
    { key: "images", title: "이미지 생성", icon: ImageRegular },
    { key: "video", title: "영상 합성", icon: VideoRegular },
  ];

  // 대본 생성 모드: 대본 생성 → 음성 생성 → 자막 생성
  const scriptModeSteps = [
    { key: "script", title: "대본 생성", icon: DocumentEditRegular },
    { key: "audio", title: "음성 생성", icon: MicRegular },
    { key: "subtitle", title: "자막 생성", icon: DocumentEditRegular },
  ];

  // 현재 모드에 따른 단계 배열 선택
  const steps = fullVideoState.mode === "automation_mode" ? automationSteps : scriptModeSteps;

  /**
   * 시작 시간부터 현재까지의 경과 시간을 계산하여 문자열로 반환
   * @returns {string} "X분 Y초" 또는 "Y초" 형태의 경과 시간
   */
  const getElapsedTime = () => {
    if (!fullVideoState.startTime) return "0초";
    const elapsed = Math.floor((new Date() - fullVideoState.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
  };

  return (
    <Card
      style={{
        // 상태에 따른 배경색 변경
        background:
          fullVideoState.currentStep === "complete"
            ? tokens.colorPaletteLightGreenBackground1    // 완료: 연한 녹색
            : fullVideoState.currentStep === "error"
            ? tokens.colorPaletteRedBackground1           // 오류: 연한 빨간색
            : "#fff",                                     // 진행중: 흰색
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
        borderRadius: 14,
        padding: tokens.spacingVerticalL,
        marginBottom: tokens.spacingVerticalL,
      }}
    >
      {/* 패널 헤더: 제목, 경과 시간, 취소 버튼 */}
      <CardHeader style={{ paddingBottom: tokens.spacingVerticalM }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {/* 모드별 제목 표시 */}
            <Text size={500} weight="semibold">
              {fullVideoState.mode === "automation_mode"
                ? "🎬 완전 자동화 영상 생성"
                : "📝 대본 & 음성 & 자막 생성"
              }
            </Text>
            {/* 상태별 부제목 및 경과 시간 표시 */}
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
              {fullVideoState.currentStep === "complete"
                ? `✅ 완료! (총 소요시간: ${getElapsedTime()})`
                : fullVideoState.currentStep === "error"
                ? `❌ 오류 발생 (${getElapsedTime()} 경과)`
                : `🔄 진행 중... (${getElapsedTime()} 경과)`}
            </Text>
          </div>
          {/* 상태별 버튼 표시 */}
          <div style={{ display: "flex", gap: 8 }}>
            {/* 디버깅 정보 (개발용) */}
            {process.env.NODE_ENV === 'development' && (
              <Text size={100} style={{ opacity: 0.6 }}>
                Debug: {fullVideoState.mode} | {fullVideoState.currentStep} | {fullVideoState.isGenerating ? 'generating' : 'idle'}
              </Text>
            )}

            {fullVideoState.isGenerating ? (
              /* 진행 중일 때 취소 버튼 */
              <Button
                appearance="secondary"
                size="small"
                onClick={resetFullVideoState}
              >
                취소
              </Button>
            ) : (
              /* 진행이 끝났을 때 닫기 버튼 */
              <Button
                appearance="primary"
                size="small"
                onClick={resetFullVideoState}
              >
                닫기
              </Button>
            )}

            {/* 추가 취소 버튼 (항상 표시) */}
            {!fullVideoState.isGenerating && (
              <Button
                appearance="secondary"
                size="small"
                onClick={resetFullVideoState}
              >
                초기화
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* 진행 단계 표시 영역 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: tokens.spacingVerticalL,
          padding: tokens.spacingVerticalM,
          backgroundColor: tokens.colorNeutralBackground1,
          borderRadius: 12,
        }}
      >
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            {/* 개별 진행 단계 컴포넌트 */}
            <ProgressStepComponent
              step={step.key}
              currentStep={fullVideoState.currentStep}
              progress={fullVideoState.progress}
              title={step.title}
              icon={step.icon}
              mode={fullVideoState.mode}
              isCompleted={
                fullVideoState.currentStep === "completed" || fullVideoState.currentStep === "complete"
              }
              hasError={fullVideoState.currentStep === "error"}
            />

            {/* 단계 간 연결선 (마지막 단계 제외) */}
            {index < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: tokens.colorNeutralStroke2,
                  margin: "0 16px",
                  position: "relative",
                }}
              >
                {/* 진행률에 따른 연결선 색상 변경 */}
                <div
                  style={{
                    height: "100%",
                    backgroundColor: (() => {
                      const stepOrder = fullVideoState.mode === "automation_mode"
                        ? ["script", "audio", "images", "video"]
                        : ["script", "audio", "subtitle"];

                      const currentIndex = stepOrder.indexOf(fullVideoState.currentStep);
                      const isCompleted = fullVideoState.currentStep === "completed" || fullVideoState.currentStep === "complete";

                      // 현재 단계가 연결선보다 앞서거나 완료되면 녹색, 아니면 회색
                      return (currentIndex > index || isCompleted)
                        ? tokens.colorPaletteLightGreenForeground1
                        : tokens.colorNeutralStroke2;
                    })(),
                    transition: "all 0.3s ease",
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 진행 로그 표시 (로그가 있을 때만) */}
      {fullVideoState.logs.length > 0 && (
        <div
          style={{
            backgroundColor: tokens.colorNeutralBackground2,
            borderRadius: 8,
            padding: tokens.spacingVerticalS,
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          <Text size={300} weight="semibold" style={{ marginBottom: 8 }}>
            📋 진행 로그
          </Text>
          {/* 최근 5개 로그만 표시 */}
          {fullVideoState.logs.slice(-5).map((log, index) => (
            <div key={index} style={{ marginBottom: 4 }}>
              <Text
                size={200}
                style={{
                  // 로그 타입별 색상 지정
                  color:
                    log.type === "error"
                      ? tokens.colorPaletteRedForeground1           // 오류: 빨간색
                      : log.type === "success"
                      ? tokens.colorPaletteLightGreenForeground1    // 성공: 녹색
                      : tokens.colorNeutralForeground2,             // 기본: 회색
                }}
              >
                [{log.timestamp}] {log.message}
              </Text>
            </div>
          ))}
        </div>
      )}

      {/* 완료 시 액션 버튼들 (자동화 모드 완료 + 영상 결과 있을 때만) */}
      {fullVideoState.currentStep === "complete" && fullVideoState.results.video && (
        <div
          style={{
            marginTop: tokens.spacingVerticalM,
            display: "flex",
            gap: tokens.spacingHorizontalM,
          }}
        >
          {/* 출력 폴더 열기 버튼 */}
          <Button
            appearance="primary"
            icon={<FolderOpenRegular />}
            onClick={async () => {
              try {
                /**
                 * API 호출: project:openOutputFolder
                 * @description 프로젝트 출력 폴더를 시스템 파일 탐색기로 열기
                 * @returns {Object} { success: boolean, message?: string }
                 */
                const result = await api.invoke("project:openOutputFolder");

                if (result.success) {
                  toast.success("출력 폴더를 열었습니다.");
                } else {
                  toast.error(`폴더 열기 실패: ${result.message}`);
                }
              } catch (error) {
                toast.error(`오류: ${error.message}`);
              }
            }}
          >
            출력 폴더 열기
          </Button>

          {/* 영상 재생 버튼 (미구현) */}
          <Button
            appearance="secondary"
            icon={<PlayRegular />}
            onClick={() => {
              toast.success("영상 재생 기능 구현 예정");
            }}
          >
            영상 재생
          </Button>
        </div>
      )}
    </Card>
  );
}

export default FullVideoProgressPanel;

/**
 * @typedef {Object} FullVideoState
 * @property {boolean} isGenerating - 현재 생성 진행 중 여부
 * @property {string} currentStep - 현재 진행 단계
 * @property {string} mode - 실행 모드 (automation_mode | script_mode | idle)
 * @property {Object} progress - 각 단계별 진행률 (0-100)
 * @property {Date} startTime - 생성 시작 시간
 * @property {Array} logs - 진행 로그 배열
 * @property {Object} results - 생성 결과 객체
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} timestamp - 로그 시간 (HH:MM:SS 형태)
 * @property {string} message - 로그 메시지
 * @property {('info'|'success'|'error'|'warning')} type - 로그 타입
 */

/**
 * 사용되는 API 목록:
 *
 * 1. project:openOutputFolder
 *    - 설명: 프로젝트 출력 폴더를 시스템 파일 탐색기로 열기
 *    - 매개변수: 없음
 *    - 반환값: { success: boolean, message?: string }
 *    - 사용: 완료 후 "출력 폴더 열기" 버튼 클릭 시
 */