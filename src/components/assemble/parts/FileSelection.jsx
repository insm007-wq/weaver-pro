import React, { useState } from "react";
import { tokens, Text, Card, Button, Caption1, CardFooter } from "@fluentui/react-components";
import {
  FolderOpen24Regular,
  LinkSquare24Regular,
  DismissCircle24Regular,
  TextDescriptionRegular,
  MusicNote2Regular,
  CheckmarkCircle20Filled,
  ArrowUpload24Regular,
} from "@fluentui/react-icons";

// DropZone 컴포넌트를 FileSelection 내부로 이동
const DropZone = ({ icon, label, caption, connected, onClick, inputRef, accept, onChange, inputId }) => {
  // 더 생생한 색상으로 개선
  const iconColor = connected ? tokens.colorPaletteGreenForeground1 : tokens.colorBrandForeground1;
  const hoverBg = connected ? tokens.colorPaletteGreenBackground3 : tokens.colorBrandBackground2;
  const ringColor = connected ? tokens.colorPaletteGreenBorderActive : tokens.colorBrandStroke1;
  const cardBg = connected ? tokens.colorPaletteGreenBackground1 : tokens.colorNeutralBackground1;
  const textColor = connected ? tokens.colorPaletteGreenForeground2 : tokens.colorBrandForeground1;

  // 드래그 앤 드롭 상태
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      // 파일 확장자 체크
      const acceptedTypes = accept.split(",").map((type) => type.trim().toLowerCase());
      const fileName = files[0].name.toLowerCase();
      const fileExtension = "." + fileName.split(".").pop();

      if (acceptedTypes.includes(fileExtension)) {
        onChange?.(files[0]);
      } else {
        console.warn(`지원하지 않는 파일 형식입니다. 허용된 형식: ${accept}`);
      }
    }
  };

  return (
    <Card
      appearance="outline"
      style={{
        height: "100%",
        boxShadow: isDragOver
          ? `0 0 0 3px ${tokens.colorBrandStroke1}, 0 8px 32px rgba(0, 120, 212, 0.25)`
          : connected
          ? `0 0 0 2px ${ringColor}, 0 4px 16px rgba(34, 139, 34, 0.15)`
          : `0 0 0 1px ${tokens.colorNeutralStroke2}, 0 2px 8px rgba(0, 0, 0, 0.08)`,
        transition: "all 200ms cubic-bezier(0.23, 1, 0.32, 1)",
        cursor: "pointer",
        backgroundColor: isDragOver ? tokens.colorBrandBackground2 : cardBg,
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
      onMouseEnter={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = connected
            ? `0 0 0 2px ${ringColor}, 0 8px 24px rgba(34, 139, 34, 0.2)`
            : `0 0 0 1px ${tokens.colorBrandStroke1}, 0 6px 20px rgba(0, 0, 0, 0.12)`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragOver) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = connected
            ? `0 0 0 2px ${ringColor}, 0 4px 16px rgba(34, 139, 34, 0.15)`
            : `0 0 0 1px ${tokens.colorNeutralStroke2}, 0 2px 8px rgba(0, 0, 0, 0.08)`;
        }
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
          minHeight: "200px",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onChange?.(e.target.files[0]);
              e.target.value = null;
            }
          }}
          id={inputId}
        />
        <div
          style={{
            color: isDragOver ? tokens.colorBrandForeground1 : iconColor,
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
            color: isDragOver ? tokens.colorBrandForeground1 : textColor,
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
            color: connected ? tokens.colorPaletteGreenForeground1 : textColor,
            fontWeight: 600,
            transition: "all 200ms ease",
          }}
        >
          {connected ? "연결 완료" : "파일 선택"}
        </Button>
      </CardFooter>
    </Card>
  );
};

const FileSelection = ({
  srtConnected,
  srtFilePath,
  scenes,
  totalDur,
  getFileInfo,
  openSrtPicker,
  srtInputRef,
  handleSrtUpload,
  srtInputId,
  mp3Connected,
  mp3FilePath,
  audioDur,
  openMp3Picker,
  mp3InputRef,
  handleMp3Upload,
  mp3InputId,
  handleInsertFromScript,
  handleReset,
}) => {
  return (
    <Card
      style={{
        padding: "12px 16px",
        borderRadius: "16px",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        height: "fit-content",
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
          파일을 드래그하거나 버튼을 클릭하여 업로드하세요
        </Text>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: tokens.spacingHorizontalL,
          padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL}`,
        }}
      >
        <DropZone
          icon={<TextDescriptionRegular />}
          label="SRT 자막 파일"
          caption={
            srtConnected && srtFilePath ? (
              <div style={{ whiteSpace: "pre-line", textAlign: "center", lineHeight: 1.3, fontSize: "13px" }}>
                {`📁 ${getFileInfo(srtFilePath).displayPath}\n📄 ${getFileInfo(srtFilePath).fileName} (${
                  scenes.length
                }개 씬, ${totalDur.toFixed(1)}초)`}
              </div>
            ) : (
              "SRT 파일 업로드 (.srt)"
            )
          }
          connected={srtConnected}
          onClick={openSrtPicker}
          inputRef={srtInputRef}
          accept=".srt"
          onChange={handleSrtUpload}
          inputId={srtInputId}
        />

        <DropZone
          icon={<MusicNote2Regular />}
          label="오디오 파일 (MP3/WAV/M4A)"
          caption={
            mp3Connected && mp3FilePath && audioDur > 0 ? (
              <div style={{ whiteSpace: "pre-line", textAlign: "center", lineHeight: 1.3, fontSize: "13px" }}>
                {`📁 ${getFileInfo(mp3FilePath).displayPath}\n🎵 ${getFileInfo(mp3FilePath).fileName} (${audioDur.toFixed(1)}초)`}
              </div>
            ) : (
              "MP3, WAV, M4A 지원"
            )
          }
          connected={mp3Connected}
          onClick={openMp3Picker}
          inputRef={mp3InputRef}
          accept=".mp3,.wav,.m4a"
          onChange={handleMp3Upload}
          inputId={mp3InputId}
        />
      </div>
    </Card>
  );
};

export default FileSelection;
