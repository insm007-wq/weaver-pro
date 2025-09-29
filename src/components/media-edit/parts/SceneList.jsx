import React, { useState, useCallback } from "react";
import { Text, Button, Card, Badge, Avatar, Input, Textarea } from "@fluentui/react-components";
import {
  DocumentTextRegular,
  ClockRegular,
  AutoFitWidthRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
} from "@fluentui/react-icons";
import { ensureSceneDefaults } from "../../../utils/scenes";
import { analyzeSceneKeywords, getRecommendedVideosForScene, assignVideosToScenes } from "../../../services/videoAssignment";
import { showError, showSuccess } from "../../common/GlobalToast";

function SceneList({
  scenes,
  setScenes,
  selectedSceneIndex,
  onSceneSelect,
}) {
  // 내부 편집 상태 관리
  const [editingSceneIndex, setEditingSceneIndex] = useState(-1);
  const [editingText, setEditingText] = useState("");
  const [editingStartTime, setEditingStartTime] = useState("");
  const [editingEndTime, setEditingEndTime] = useState("");
  const [keywordAnalysis, setKeywordAnalysis] = useState([]);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [isAssigning, setIsAssigning] = useState(false);
  // 시간 포맷 헬퍼
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 시간 문자열을 초로 변환하는 헬퍼 함수
  const timeStringToSeconds = (timeStr) => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    return minutes * 60 + seconds;
  };

  // VREW 스타일 편집 핸들러들
  const handleStartEditText = useCallback((index) => {
    const scene = scenes[index];
    setEditingSceneIndex(index);
    setEditingText(scene.text || "");
    setEditingStartTime(formatTime(scene.start));
    setEditingEndTime(formatTime(scene.end));
  }, [scenes]);

  const handleCancelEdit = useCallback(() => {
    setEditingSceneIndex(-1);
    setEditingText("");
    setEditingStartTime("");
    setEditingEndTime("");
    setKeywordAnalysis([]);
    setRecommendedVideos([]);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingSceneIndex === -1) return;

    const updatedScenes = [...scenes];
    const scene = updatedScenes[editingSceneIndex];

    // 텍스트 업데이트
    scene.text = editingText;

    // 시간 업데이트 (시간 포맷을 초로 변환)
    const startSeconds = timeStringToSeconds(editingStartTime);
    const endSeconds = timeStringToSeconds(editingEndTime);

    if (startSeconds !== null) scene.start = startSeconds;
    if (endSeconds !== null) scene.end = endSeconds;

    setScenes(updatedScenes);
    handleCancelEdit();

    console.log("[자막 편집] 씬 저장됨:", { index: editingSceneIndex, text: editingText });
  }, [editingSceneIndex, editingText, editingStartTime, editingEndTime, scenes, setScenes, handleCancelEdit]);

  // 더블클릭으로 편집 모드 진입
  const handleSceneDoubleClick = useCallback((index, event) => {
    event.stopPropagation();
    handleStartEditText(index);
  }, [handleStartEditText]);

  // 실시간 텍스트 변경 핸들러 (VREW 스타일)
  const handleTextChange = useCallback(async (newText) => {
    setEditingText(newText);

    // 키워드 분석
    const analysis = analyzeSceneKeywords(newText);
    setKeywordAnalysis(analysis);

    // 추천 영상 업데이트 (디바운싱)
    if (newText.trim().length > 2) {
      try {
        const recommendations = await getRecommendedVideosForScene({ text: newText }, 3);
        setRecommendedVideos(recommendations);
      } catch (error) {
        console.error("[실시간 추천] 오류:", error);
        setRecommendedVideos([]);
      }
    } else {
      setRecommendedVideos([]);
    }
  }, []);

  // 자동 영상 할당 핸들러 (에러 핸들링 강화)
  const handleAutoAssignVideos = useCallback(async () => {
    console.log("[UI 자동 할당] 🚀 버튼 클릭됨!");
    console.log("[UI 자동 할당] 현재 scenes:", scenes);

    // 입력 검증
    if (!scenes || scenes.length === 0) {
      showError("할당할 씬이 없습니다.");
      return;
    }

    // 텍스트가 있는 씬이 있는지 확인
    const scenesWithText = scenes.filter(scene => scene.text && scene.text.trim().length > 0);
    if (scenesWithText.length === 0) {
      showError("텍스트가 있는 씬이 없습니다. 먼저 자막을 작성해주세요.");
      return;
    }

    setIsAssigning(true);
    try {
      console.log("[UI 자동 할당] 시작:", { sceneCount: scenes.length });
      console.log("[UI 자동 할당] assignVideosToScenes 함수 호출 전...");

      const assignedScenes = await assignVideosToScenes(scenes, {
        minScore: 0.1, // VREW 스타일: 관대한 매칭
        allowDuplicates: false, // 중복 방지
      });

      console.log("[UI 자동 할당] assignVideosToScenes 완료:", { assignedScenes });

      // 할당 결과 디버깅
      console.log("[자동 할당] 할당 전 scenes:", scenes);
      console.log("[자동 할당] 할당 후 assignedScenes:", assignedScenes);

      // 씬 업데이트
      setScenes(assignedScenes);

      // 할당 결과 확인
      const assignedCount = assignedScenes.filter((scene) => scene.asset?.path).length;
      const totalCount = assignedScenes.length;

      console.log("[자동 할당] 할당된 씬 수:", assignedCount, "/", totalCount);

      // 할당된 씬들의 상세 정보 출력
      assignedScenes.forEach((scene, index) => {
        if (scene.asset?.path) {
          console.log(`[자동 할당] 씬 ${index + 1}:`, {
            text: scene.text,
            asset: scene.asset,
          });
        }
      });

      if (assignedCount > 0) {
        showSuccess(`${assignedCount}/${totalCount}개 씬에 영상을 자동으로 할당했습니다.`);
      } else {
        showError("자동으로 할당할 수 있는 영상이 없습니다. 먼저 미디어 다운로드에서 영상을 다운로드해주세요.");
      }
    } catch (error) {
      console.error("[자동 할당] 오류:", error);
      showError(`자동 할당 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  }, [scenes, setScenes]);

  return (
    <Card
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DocumentTextRegular style={{ fontSize: 18 }} />
          <Text size={400} weight="semibold">
            씬 목록
          </Text>
          <Badge appearance="filled" size="small">
            {scenes.length}
          </Badge>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            appearance="primary"
            size="small"
            icon={<AutoFitWidthRegular />}
            onClick={handleAutoAssignVideos}
            disabled={isAssigning || scenes.length === 0}
          >
            {isAssigning ? "할당 중..." : "자동 할당"}
          </Button>
          <Button appearance="subtle" size="small" icon={<ArrowSyncRegular />} />
        </div>
      </div>

      {/* 씬 목록 스크롤 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {scenes.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <Text size={300} style={{ color: "#666" }}>
              씬가 없습니다
            </Text>
          </div>
        ) : (
          scenes.map((scene, index) => {
            const isSelected = index === selectedSceneIndex;
            const isEditing = index === editingSceneIndex;
            const sceneWithDefaults = ensureSceneDefaults(scene);
            const hasMedia = sceneWithDefaults.asset?.path;

            return (
              <div
                key={scene.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: `2px solid ${isEditing ? "#ff6b35" : isSelected ? "#0078d4" : "#e1dfdd"}`,
                  backgroundColor: isEditing ? "#fff4f1" : isSelected ? "#f3f9ff" : "transparent",
                  cursor: isEditing ? "default" : "pointer",
                  transition: "all 0.2s ease",
                }}
                onClick={isEditing ? undefined : () => onSceneSelect(index)}
                onDoubleClick={isEditing ? undefined : (e) => handleSceneDoubleClick(index, e)}
              >
                {/* 헤더 영역 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Avatar size={20} name={`씬 ${index + 1}`} color={hasMedia ? "colorful" : "neutral"} />
                  <Text size={300} weight="medium" style={{ fontSize: "14px" }}>
                    씬 {index + 1}
                  </Text>
                  <div style={{ flex: 1 }} />

                  {/* 시간 편집 영역 */}
                  {isEditing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Input
                        size="small"
                        value={editingStartTime}
                        onChange={(e) => setEditingStartTime(e.target.value)}
                        placeholder="00:00"
                        style={{ width: 60, fontSize: "12px" }}
                      />
                      <Text size={200}>-</Text>
                      <Input
                        size="small"
                        value={editingEndTime}
                        onChange={(e) => setEditingEndTime(e.target.value)}
                        placeholder="00:00"
                        style={{ width: 60, fontSize: "12px" }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ClockRegular style={{ fontSize: 12 }} />
                      <Text size={200} style={{ color: "#666" }}>
                        {formatTime(scene.start)} - {formatTime(scene.end)}
                      </Text>
                    </div>
                  )}
                </div>

                {/* 자막 텍스트 영역 */}
                {isEditing ? (
                  <div style={{ marginBottom: 8 }}>
                    <Textarea
                      value={editingText}
                      onChange={(e) => handleTextChange(e.target.value)}
                      placeholder="자막을 입력하세요..."
                      resize="vertical"
                      rows={4}
                      style={{
                        width: "100%",
                        fontSize: "15px",
                        lineHeight: "1.5",
                        padding: "12px",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "8px 0",
                      minHeight: "40px",
                      cursor: "text",
                      borderRadius: "4px",
                      position: "relative",
                    }}
                    onDoubleClick={(e) => handleSceneDoubleClick(index, e)}
                  >
                    <Text
                      size={300}
                      style={{
                        color: scene.text ? "#333" : "#999",
                        fontSize: "13px",
                        lineHeight: "1.4",
                        display: "block",
                        wordWrap: "break-word",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {scene.text || "더블클릭하여 자막을 편집하세요..."}
                    </Text>
                  </div>
                )}

                {/* VREW 스타일 실시간 분석 영역 */}
                {isEditing && (keywordAnalysis.length > 0 || recommendedVideos.length > 0) && (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: 8,
                      backgroundColor: "#f8f9ff",
                      borderRadius: 6,
                      border: "1px solid #e1e8ff",
                    }}
                  >
                    {/* 키워드 분석 */}
                    {keywordAnalysis.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <Text
                          size={200}
                          weight="medium"
                          style={{ fontSize: "11px", color: "#666", marginBottom: 4, display: "block" }}
                        >
                          🔍 추출된 키워드
                        </Text>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {keywordAnalysis.map((item, idx) => (
                            <Badge
                              key={idx}
                              appearance="outline"
                              color={item.type === "korean" ? "brand" : "success"}
                              size="small"
                              style={{ fontSize: "10px" }}
                            >
                              {item.korean} {item.english.length > 0 && `→ ${item.english[0]}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 추천 영상 */}
                    {recommendedVideos.length > 0 && (
                      <div>
                        <Text
                          size={200}
                          weight="medium"
                          style={{ fontSize: "11px", color: "#666", marginBottom: 4, display: "block" }}
                        >
                          🎬 추천 영상 (점수순)
                        </Text>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {recommendedVideos.map((video, idx) => (
                            <Badge key={idx} appearance="tint" color="warning" size="small" style={{ fontSize: "10px" }}>
                              {video.keyword} ({(video.score * 100).toFixed(0)}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 편집 버튼 영역 */}
                {isEditing && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <Button appearance="primary" size="small" onClick={handleSaveEdit}>
                      저장
                    </Button>
                    <Button appearance="secondary" size="small" onClick={handleCancelEdit}>
                      취소
                    </Button>
                  </div>
                )}

                {/* 미디어 상태 표시 */}
                {hasMedia && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Badge appearance="tint" color="success" size="small">
                      <CheckmarkCircleRegular style={{ fontSize: 12, marginRight: 3 }} />
                      {sceneWithDefaults.asset.type === "image" ? "이미지" : "영상"} 연결됨
                    </Badge>
                    {sceneWithDefaults.asset.keyword && (
                      <Badge appearance="outline" size="small" style={{ fontSize: "12px" }}>
                        키워드: {sceneWithDefaults.asset.keyword}
                      </Badge>
                    )}
                  </div>
                )}

                {/* 편집 힌트 */}
                {!isEditing && !hasMedia && (
                  <div style={{ marginTop: 6 }}>
                    <Text size={200} style={{ color: "#999", fontSize: "11px" }}>
                      💡 더블클릭하여 편집 • 자동 할당으로 영상 추가
                    </Text>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

export default SceneList;