/**
 * 씬 미리보기 카드 컴포넌트
 * 
 * @description
 * 생성된 대본의 씬들을 미리보기 형태로 보여주는 카드 컴포넌트
 * DataGrid를 사용하여 씬 목록을 테이블 형태로 표시하고, 각 씬의 상세 정보 제공
 * 
 * @component 씬 미리보기 카드
 * 
 * @usage
 * - ScriptVoiceGenerator.jsx: 생성된 대본 씬들의 미리보기
 * - 대본 생성 후 사용자에게 결과 제공
 * 
 * @props
 * @param {Object|null} doc - 생성된 대본 문서 객체
 * @param {Array} doc.scenes - 씬 배열
 * @param {string} doc.scenes[].text - 씬 텍스트 내용
 * @param {number} doc.scenes[].duration - 씬 길이 (초)
 * @param {number} [doc.scenes[].scene_number] - 씬 번호
 * @param {string} error - 오류 메시지
 * 
 * @features
 * - 📋 씬 목록을 테이블 형태로 표시
 * - 📝 각 씬의 텍스트 내용 미리보기
 * - ⏱️ 씬별 지속 시간 표시
 * - 🔢 글자 수 통계 제공
 * - 📊 DataGrid를 통한 정렬 및 탐색 기능
 * - 🔄 빈 상태 및 오류 상태 처리
 * 
 * @states
 * - 데이터 없음: 안내 메시지 표시
 * - 오류 발생: 오류 메시지 표시
 * - 정상 상태: 씬 목록 테이블 표시
 * 
 * @example
 * ```jsx
 * import ScenePreviewCard from './ScenePreviewCard';
 * 
 * function MyComponent() {
 *   const doc = {
 *     scenes: [
 *       { text: '첫 번째 씬 내용...', duration: 30, scene_number: 1 },
 *       { text: '두 번째 씬 내용...', duration: 45, scene_number: 2 }
 *     ]
 *   };
 *   
 *   return (
 *     <ScenePreviewCard
 *       doc={doc}
 *       error=""
 *     />
 *   );
 * }
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React from "react";
import {
  Card,
  Text,
  Badge,
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridCell,
  DataGridBody,
  createTableColumn,
  MessageBar,
  MessageBarBody,
  tokens,
} from "@fluentui/react-components";
import { 
  VideoRegular,
  CheckmarkCircleRegular 
} from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { safeCharCount } from "../../../utils/safeChars";

/**
 * 씬 미리보기 카드 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 props
 * @returns {JSX.Element} 씬 미리보기 카드 JSX
 */
function ScenePreviewCard({ doc, error }) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  /**
   * DataGrid 컬럼 정의
   */
  const columns = [
    createTableColumn({
      columnId: "scene_number",
      renderHeaderCell: () => "#",
      renderCell: (item, index) => (
        <Text weight="semibold" size={200}>
          {item.scene_number ?? index + 1}
        </Text>
      ),
    }),
    createTableColumn({
      columnId: "duration", 
      renderHeaderCell: () => "지속 시간",
      renderCell: (item) => (
        <Text size={200}>
          {item.duration}초
        </Text>
      ),
    }),
    createTableColumn({
      columnId: "charCount",
      renderHeaderCell: () => "글자수", 
      renderCell: (item) => (
        <Text size={200}>
          {safeCharCount(item.text)}자
        </Text>
      ),
    }),
    createTableColumn({
      columnId: "text",
      renderHeaderCell: () => "텍스트",
      renderCell: (item) => (
        <div style={{ maxWidth: "400px" }}>
          <Text size={200} style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", 
            overflow: "hidden",
            lineHeight: 1.4,
          }}>
            {item.text}
          </Text>
        </div>
      ),
    }),
  ];

  /**
   * 씬 개수와 통계
   */
  const sceneCount = doc?.scenes?.length || 0;
  const totalChars = doc?.scenes?.reduce((sum, scene) => sum + safeCharCount(scene.text), 0) || 0;
  const totalDuration = doc?.scenes?.reduce((sum, scene) => sum + (scene.duration || 0), 0) || 0;

  return (
    <Card className={cardStyles.resultCard}>
      {/* 카드 헤더 - 기존 스타일 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Text weight="semibold">씬 미리보기</Text>
        <Badge appearance="tint">{sceneCount > 0 ? `${sceneCount}개 씬` : "대본 없음"}</Badge>
      </div>

      {/* 씬 목록이 있는 경우 - 기존 스타일 */}
      {sceneCount > 0 ? (
        <DataGrid
          items={doc.scenes}
          columns={columns}
        >
          <DataGridHeader>
            <DataGridRow>
              {({ renderHeaderCell }) => (
                <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
              )}
            </DataGridRow>
          </DataGridHeader>
          <DataGridBody>
            {({ item, rowId }) => (
              <DataGridRow key={rowId}>
                {({ renderCell }) => (
                  <DataGridCell>{renderCell(item)}</DataGridCell>
                )}
              </DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      ) : (
        /* 빈 상태 - 기존 스타일 */
        <div style={{ textAlign: "center", padding: 36 }}>
          <Text>대본을 생성하거나 SRT를 불러오면 씬 목록이 표시됩니다.</Text>
        </div>
      )}

      {/* 오류 메시지 */}
      {error && (
        <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalM }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
    </Card>
  );
}

export default ScenePreviewCard;