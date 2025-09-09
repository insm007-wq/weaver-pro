import { Card, Title3, Caption1, Body1, Button, Badge } from "@fluentui/react-components";
import { ArrowDownloadRegular } from "@fluentui/react-icons";
import { tokens } from "@fluentui/react-components";

const ResultsDisplay = ({ 
  results, 
  tookMs, 
  provider,
  setToast 
}) => {
  if (results.length === 0) return null;

  return (
    <div style={{ marginTop: tokens.spacingVerticalXXL }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        marginBottom: tokens.spacingVerticalM 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
          <span>🎉</span>
          <Title3>생성 완료!</Title3>
          {tookMs != null && (
            <Caption1>
              {(tookMs / 1000).toFixed(1)}초 만에 {results.length}개의 썸네일이 생성되었습니다.
            </Caption1>
          )}
        </div>
        <Badge appearance="filled" color="success" size="medium">
          {provider === "replicate" ? "Replicate (Flux)" : "Google Gemini (Imagen 3)"}
        </Badge>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: tokens.spacingHorizontalL,
      }}>
        {results.map((r, i) => (
          <Card key={i} style={{ overflow: "hidden" }}>
            <div style={{ backgroundColor: "rgba(0,0,0,0.05)" }}>
              <img 
                src={r.url} 
                alt={`thumb-${i + 1}`} 
                style={{
                  width: "100%",
                  height: "auto",
                  objectFit: "cover",
                }}
              />
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: tokens.spacingVerticalM,
            }}>
              <Body1 weight="semibold">썸네일 #{i + 1}</Body1>
              <div style={{
                display: "flex",
                gap: tokens.spacingHorizontalS,
              }}>
                <Button
                  size="small"
                  appearance="outline"
                  icon={<ArrowDownloadRegular />}
                  onClick={async () => {
                    const res = await window.api.saveUrlToFile({
                      url: r.url,
                      suggestedName: `thumbnail-${i + 1}.jpg`,
                    });
                    if (!res?.ok && res?.message !== "canceled") {
                      setToast({ 
                        type: "error", 
                        text: `저장 실패: ${res?.message || "알 수 없는 오류"}` 
                      });
                    } else if (res?.ok) {
                      setToast({ 
                        type: "success", 
                        text: "썸네일이 성공적으로 저장되었습니다!" 
                      });
                    }
                  }}
                >
                  다운로드
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ResultsDisplay;