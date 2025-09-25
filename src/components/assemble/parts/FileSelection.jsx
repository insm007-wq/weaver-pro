import React from "react";
import { tokens, Text, Card, Button } from "@fluentui/react-components";
import {
  FolderOpen24Regular,
  LinkSquare24Regular,
  DismissCircle24Regular,
  TextDescriptionRegular,
  MusicNote2Regular,
} from "@fluentui/react-icons";

const FileSelection = ({
  DropZone,
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
