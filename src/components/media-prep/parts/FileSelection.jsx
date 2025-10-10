import { useState, useCallback, useMemo, memo } from "react";
import { tokens, Text, Card, Button, Caption1, CardFooter } from "@fluentui/react-components";
import {
  FolderOpen24Regular,
  LinkSquare24Regular,
  DismissCircle24Regular,
  TextDescriptionRegular,
  CheckmarkCircle20Filled,
  ArrowUpload24Regular,
} from "@fluentui/react-icons";

// DropZone 컴포넌트 - 성능 최적화를 위해 메모화
const DropZone = memo(({ icon, label, caption, connected, onClick, inputRef, accept, onChange, inputId }) => {
  // 색상 테마 계산 메모화
  const colorTheme = useMemo(
    () => ({
      iconColor: connected ? tokens.colorPaletteGreenForeground1 : tokens.colorBrandForeground1,
      hoverBg: connected ? tokens.colorPaletteGreenBackground3 : tokens.colorBrandBackground2,
      ringColor: connected ? tokens.colorPaletteGreenBorderActive : tokens.colorBrandStroke1,
      cardBg: connected ? tokens.colorPaletteGreenBackground1 : tokens.colorNeutralBackground1,
      textColor: connected ? tokens.colorPaletteGreenForeground2 : tokens.colorBrandForeground1,
    }),
    [connected]
  );

  // 드래그 앤 드롭 상태
  const [isDragOver, setIsDragOver] = useState(false);

  // 드래그 이벤트 핸들러 최적화
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // 실제로 컨테이너를 떠날 때만 상태 변경
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      try {
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) {
          console.warn("드롭된 파일이 없습니다.");
          return;
        }

        const file = files[0];

        // 파일 크기 검증 (50MB 제한)
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_FILE_SIZE) {
          console.error(`파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 지원됩니다.`);
          return;
        }

        // 파일 확장자 검증 강화
        const acceptedTypes = accept.split(",").map((type) => type.trim().toLowerCase());
        const fileName = file.name.toLowerCase();
        const fileExtension = "." + fileName.split(".").pop();

        if (acceptedTypes.includes(fileExtension)) {
          onChange?.(file);
        } else {
          console.warn(`지원하지 않는 파일 형식입니다. 허용된 형식: ${accept}`);
        }
      } catch (error) {
        console.error("파일 드롭 처리 중 오류:", error);
      }
    },
    [accept, onChange]
  );

  return (
    <Card
      appearance="outline"
      style={{
        height: "100%",
        boxShadow: isDragOver
          ? `0 0 0 3px ${tokens.colorBrandStroke1}, 0 8px 32px rgba(0, 120, 212, 0.25)`
          : connected
          ? `0 0 0 2px ${colorTheme.ringColor}, 0 4px 16px rgba(34, 139, 34, 0.15)`
          : `0 0 0 1px ${tokens.colorNeutralStroke2}, 0 2px 8px rgba(0, 0, 0, 0.08)`,
        transition: "all 200ms cubic-bezier(0.23, 1, 0.32, 1)",
        cursor: "pointer",
        backgroundColor: isDragOver ? tokens.colorBrandBackground2 : colorTheme.cardBg,
        display: "flex",
        flexDirection: "column",
        transform: isDragOver ? "scale(1.02)" : "translateY(0)",
        position: "relative",
        overflow: "hidden",
      }}
      onClick={onClick}
      tabIndex={0}
      aria-labelledby={inputId}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={useCallback(
        (e) => {
          if (!isDragOver) {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = connected
              ? `0 0 0 2px ${colorTheme.ringColor}, 0 8px 24px rgba(34, 139, 34, 0.2)`
              : `0 0 0 1px ${tokens.colorBrandStroke1}, 0 6px 20px rgba(0, 0, 0, 0.12)`;
          }
        },
        [isDragOver, connected, colorTheme.ringColor]
      )}
      onMouseLeave={useCallback(
        (e) => {
          if (!isDragOver) {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = connected
              ? `0 0 0 2px ${colorTheme.ringColor}, 0 4px 16px rgba(34, 139, 34, 0.15)`
              : `0 0 0 1px ${tokens.colorNeutralStroke2}, 0 2px 8px rgba(0, 0, 0, 0.08)`;
          }
        },
        [isDragOver, connected, colorTheme.ringColor]
      )}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
          minHeight: "180px",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={useCallback(
            (e) => {
              try {
                const file = e.target.files?.[0];
                if (file) {
                  // 파일 크기 검증
                  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
                  if (file.size > MAX_FILE_SIZE) {
                    console.error(`파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 지원됩니다.`);
                    return;
                  }
                  onChange?.(file);
                  // 동일 파일 재선택 가능하도록 value 초기화
                  e.target.value = "";
                }
              } catch (error) {
                console.error("파일 선택 처리 중 오류:", error);
              }
            },
            [onChange]
          )}
          id={inputId}
        />
        <div
          style={{
            color: isDragOver ? tokens.colorBrandForeground1 : colorTheme.iconColor,
            marginBottom: tokens.spacingVerticalS,
            transition: "all 200ms ease",
            fontSize: "24px",
            filter: connected
              ? "drop-shadow(0 2px 4px rgba(34, 139, 34, 0.3))"
              : isDragOver
              ? "drop-shadow(0 2px 8px rgba(0, 120, 212, 0.4))"
              : "none",
            transform: isDragOver ? "scale(1.1)" : "scale(1)",
          }}
        >
          {connected ? <CheckmarkCircle20Filled /> : <ArrowUpload24Regular />}
        </div>
        <Text
          size={400}
          weight="semibold"
          id={inputId}
          style={{
            marginBottom: tokens.spacingVerticalS,
            color: isDragOver ? tokens.colorBrandForeground1 : colorTheme.textColor,
            transition: "color 200ms ease",
          }}
        >
          {isDragOver ? "파일을 여기에 드롭하세요" : label}
        </Text>
        <Caption1
          style={{
            color: isDragOver
              ? tokens.colorBrandForeground2
              : connected
              ? tokens.colorPaletteGreenForeground3
              : tokens.colorNeutralForeground3,
            textAlign: "center",
            transition: "color 200ms ease",
          }}
        >
          {isDragOver ? `${accept} 파일만 지원됩니다` : caption}
        </Caption1>
      </div>
      <CardFooter>
        <Button
          appearance={connected ? "primary" : "outline"}
          size="small"
          icon={connected ? <CheckmarkCircle20Filled /> : icon}
          onClick={onClick}
          style={{
            width: "100%",
            minWidth: "200px",
            backgroundColor: connected ? tokens.colorPaletteGreenBackground1 : "transparent",
            borderColor: connected ? tokens.colorPaletteGreenBorderActive : tokens.colorBrandStroke1,
            color: connected ? tokens.colorPaletteGreenForeground1 : colorTheme.textColor,
            fontWeight: 600,
            transition: "all 200ms ease",
          }}
        >
          {connected ? "연결 완료" : "파일 선택"}
        </Button>
      </CardFooter>
    </Card>
  );
});

// FileSelection 컴포넌트 메모화로 성능 최적화
const FileSelection = memo(
  ({
    srtConnected,
    srtFilePath,
    scenes,
    totalDur,
    getFileInfo,
    openSrtPicker,
    srtInputRef,
    handleSrtUpload,
    srtInputId,
    handleInsertFromScript,
    handleReset,
  }) => {
    // 중앙 정렬 스타일 메모화
    const containerStyle = useMemo(
      () => ({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL}`,
        flex: 1,
      }),
      []
    );

    const dropZoneStyle = useMemo(
      () => ({
        width: "100%",
        maxWidth: "500px",
      }),
      []
    );

    // SRT 캡션 메모화
    const srtCaption = useMemo(() => {
      if (srtConnected && srtFilePath) {
        const fileInfo = getFileInfo(srtFilePath);
        return (
          <div style={{ whiteSpace: "pre-line", textAlign: "center", lineHeight: 1.3, fontSize: "13px" }}>
            {`📁 ${fileInfo.displayPath}\n📄 ${fileInfo.fileName} (${scenes.length}개 씬, ${totalDur.toFixed(1)}초)`}
          </div>
        );
      }
      return "SRT 파일 업로드 (.srt)";
    }, [srtConnected, srtFilePath, scenes.length, totalDur, getFileInfo]);
    return (
      <Card
        style={{
          padding: "12px 16px",
          borderRadius: "16px",
          border: `1px solid ${tokens.colorNeutralStroke2}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: tokens.spacingVerticalS }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FolderOpen24Regular />
              <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
                파일 선택
              </Text>
            </div>
            <div
              style={{
                display: "flex",
                gap: tokens.spacingHorizontalS,
                alignItems: "center",
              }}
            >
              <Button
                appearance="subtle"
                icon={<LinkSquare24Regular />}
                onClick={handleInsertFromScript}
                size="medium"
                style={{
                  color: tokens.colorBrandForeground1,
                  fontWeight: 600,
                  height: "36px",
                  minHeight: "36px",
                  padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
                  alignItems: "center",
                  display: "flex",
                  minWidth: "160px",
                }}
              >
                대본에서 가져오기
              </Button>
              <Button
                appearance="subtle"
                icon={<DismissCircle24Regular />}
                onClick={handleReset}
                size="medium"
                style={{
                  color: tokens.colorNeutralForeground3,
                  fontWeight: 600,
                  height: "36px",
                  minHeight: "36px",
                  padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
                  alignItems: "center",
                  display: "flex",
                }}
              >
                초기화
              </Button>
            </div>
          </div>
          <Text
            size={200}
            style={{
              color: tokens.colorNeutralForeground3,
              marginTop: 4,
              display: "block",
            }}
          >
            SRT 자막 파일을 드래그하거나 버튼을 클릭하여 업로드하세요
          </Text>
        </div>

        <div style={containerStyle}>
          <div style={dropZoneStyle}>
            <DropZone
              icon={<TextDescriptionRegular />}
              label="SRT 자막 파일"
              caption={srtCaption}
              connected={srtConnected}
              onClick={openSrtPicker}
              inputRef={srtInputRef}
              accept=".srt"
              onChange={handleSrtUpload}
              inputId={srtInputId}
            />
          </div>
        </div>
      </Card>
    );
  }
);

// 컴포넌트 이름 설정 (개발자 도구에서 디버깅 편의)
FileSelection.displayName = "FileSelection";
DropZone.displayName = "DropZone";

export default FileSelection;
