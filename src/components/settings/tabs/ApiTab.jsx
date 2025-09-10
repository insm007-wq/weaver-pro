import React, { useEffect, useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Card,
  Body2,
  Caption1,
  Title3,
  Button,
  Input,
  Field,
  Spinner,
  Textarea,
  Badge,
  mergeClasses,
} from "@fluentui/react-components";
import {
  KeyRegular,
  BeakerRegular,
  SaveRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ClockRegular,
} from "@fluentui/react-icons";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useCardStyles } from "../../../styles/commonStyles";

const useStyles = makeStyles({

  servicesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    ...shorthands.gap(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    width: "100%",
  },

  serviceCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
    transition: "all 0.2s ease",
    position: "relative",
    overflow: "hidden",

    "&::before": {
      content: "''",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "3px",
      background: `linear-gradient(90deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackground2} 100%)`,
    },

    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
      ...shorthands.borderColor(tokens.colorBrandStroke1),
    },
  },

  specialCard: {
    gridColumn: "1 / -1",
    maxWidth: "700px",
    margin: "0 auto",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalM,
  },

  serviceInfo: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
    flex: 1,
  },

  serviceName: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    lineHeight: "1.3",
  },

  serviceDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    lineHeight: "1.3",
  },

  statusBadge: {
    flexShrink: 0,
    marginLeft: tokens.spacingHorizontalM,
  },

  inputSection: {
    marginBottom: tokens.spacingVerticalM,
  },

  actionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginBottom: tokens.spacingVerticalS,
  },

  actionButtons: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },

  statusMessage: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    fontSize: tokens.fontSizeBase200,
  },

  successMessage: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteGreenBorder1),
  },

  errorMessage: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteRedBorder1),
  },

  timestamp: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    whiteSpace: "nowrap",
  },

  textareaField: {
    marginBottom: tokens.spacingVerticalM,
  },

  fileActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },

  compactInput: {
    "& .fui-Field__label": {
      fontSize: tokens.fontSizeBase200,
      marginBottom: tokens.spacingVerticalXXS,
    },
    "& .fui-Field__hint": {
      fontSize: tokens.fontSizeBase100,
    },
  },

  compactButton: {
    minHeight: "32px",
    fontSize: tokens.fontSizeBase200,
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalM),
  },
});

export default function ApiTab() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const s = useStyles();

  // ===== 상태 =====
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [replicateKey, setReplicateKey] = useState("");
  const [pexelsKey, setPexelsKey] = useState("");
  const [pixabayKey, setPixabayKey] = useState("");
  const [googleTtsKey, setGoogleTtsKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  const [status, setStatus] = useState({
    openai: null,
    anthropic: null,
    replicate: null,
    pexels: null,
    pixabay: null,
    googleTts: null,
    gemini: null,
  });

  const [loading, setLoading] = useState({
    openai: false,
    anthropic: false,
    replicate: false,
    pexels: false,
    pixabay: false,
    googleTts: false,
    gemini: false,
  });

  // ===== 초기 로드 =====
  useEffect(() => {
    (async () => {
      const [ok, ak, rk, gk, pxk, pbk, gmk] = await Promise.all([
        window.api.getSecret("openaiKey"),
        window.api.getSecret("anthropicKey"),
        window.api.getSecret("replicateKey"),
        window.api.getSecret("googleTtsApiKey"),
        window.api.getSecret("pexelsApiKey"),
        window.api.getSecret("pixabayApiKey"),
        window.api.getSecret("geminiKey"),
      ]);
      setOpenaiKey(ok || "");
      setAnthropicKey(ak || "");
      setReplicateKey(rk || "");
      setGoogleTtsKey(gk || "");
      setPexelsKey(pxk || "");
      setPixabayKey(pbk || "");
      setGeminiKey(gmk || "");
    })();
  }, []);

  // ===== 유틸 =====
  const setBusy = (k, v) => setLoading((x) => ({ ...x, [k]: v }));
  const setStat = (k, ok, msg) => setStatus((x) => ({ ...x, [k]: { ok, msg, ts: Date.now() } }));
  const setSaved = (k) => setStatus((x) => ({ ...x, [k]: { ok: null, msg: "키 저장됨", ts: Date.now() } }));
  const saveSecret = async (key, val) => window.api.setSecret({ key, value: (val || "").trim() });
  const stringifyErr = (m) => (typeof m === "string" ? m : JSON.stringify(m ?? ""));

  // ===== 저장 =====
  const saveOpenAI = async () => {
    await saveSecret("openaiKey", openaiKey);
    setSaved("openai");
  };
  const saveAnthropic = async () => {
    await saveSecret("anthropicKey", anthropicKey);
    setSaved("anthropic");
  };
  const saveReplicate = async () => {
    await saveSecret("replicateKey", replicateKey);
    setSaved("replicate");
  };
  const savePexels = async () => {
    await saveSecret("pexelsApiKey", pexelsKey);
    setSaved("pexels");
  };
  const savePixabay = async () => {
    await saveSecret("pixabayApiKey", pixabayKey);
    setSaved("pixabay");
  };
  const saveGoogleTts = async () => {
    await saveSecret("googleTtsApiKey", googleTtsKey);
    setSaved("googleTts");
  };
  const saveGemini = async () => {
    await saveSecret("geminiKey", geminiKey);
    setSaved("gemini");
  };

  // ===== 테스트 =====
  const testOpenAI = async () => {
    if (!openaiKey?.trim()) return setStat("openai", false, "키 미입력");
    setBusy("openai", true);
    setStat("openai", false, "");
    try {
      const res = await window.api.testOpenAI?.(openaiKey.trim());
      res?.ok
        ? setStat("openai", true, `연결 성공 (model: ${res?.model ?? "gpt-4"})`)
        : setStat("openai", false, `실패: ${stringifyErr(res?.message)}`);
    } catch (e) {
      setStat("openai", false, `오류: ${e?.message || e}`);
    } finally {
      setBusy("openai", false);
    }
  };

  const testAnthropic = async () => {
    if (!anthropicKey?.trim()) return setStat("anthropic", false, "키 미입력");
    setBusy("anthropic", true);
    setStat("anthropic", false, "");
    try {
      const res = await window.api.testAnthropic?.(anthropicKey.trim());
      res?.ok ? setStat("anthropic", true, "연결 성공") : setStat("anthropic", false, `실패: ${stringifyErr(res?.message)}`);
    } catch (e) {
      setStat("anthropic", false, `오류: ${e?.message || e}`);
    } finally {
      setBusy("anthropic", false);
    }
  };

  const testReplicate = async () => {
    setBusy("replicate", true);
    setStat("replicate", false, "");
    try {
      const res = await window.api.testReplicate?.(replicateKey.trim());
      res?.ok
        ? setStat("replicate", true, `연결 성공 (models: ${res.count})`)
        : setStat("replicate", false, `실패: ${stringifyErr(res?.message)}`);
    } catch (e) {
      setStat("replicate", false, `오류: ${e?.message || e}`);
    } finally {
      setBusy("replicate", false);
    }
  };

  const testPexels = async () => {
    if (!pexelsKey?.trim()) return setStat("pexels", false, "키 미입력");
    setBusy("pexels", true);
    setStat("pexels", false, "");
    try {
      const res = await window.api.testPexels?.(pexelsKey.trim());
      res?.ok
        ? setStat(
            "pexels",
            true,
            `연결 성공 (${res?.endpoint ?? "photos"})${res?.remaining != null ? `, 남은 호출수 ${res.remaining}` : ""}`
          )
        : setStat("pexels", false, `실패: ${stringifyErr(res?.message)}`);
    } catch (e) {
      setStat("pexels", false, `오류: ${e?.message || e}`);
    } finally {
      setBusy("pexels", false);
    }
  };

  const testPixabay = async () => {
    if (!pixabayKey?.trim()) return setStat("pixabay", false, "키 미입력");
    setBusy("pixabay", true);
    setStat("pixabay", false, "");
    try {
      const res = await window.api.testPixabay?.(pixabayKey.trim());
      res?.ok
        ? setStat("pixabay", true, `연결 성공 (${res?.endpoint ?? "photos"})${res?.hits != null ? `, 샘플 히트 ${res.hits}` : ""}`)
        : setStat("pixabay", false, `실패: ${stringifyErr(res?.message)}`);
    } catch (e) {
      setStat("pixabay", false, `오류: ${e?.message || e}`);
    } finally {
      setBusy("pixabay", false);
    }
  };

  const testGoogleTts = async () => {
    setBusy("googleTts", true);
    setStat("googleTts", false, "");
    try {
      const res = await window.api.testGoogleTTS?.(googleTtsKey.trim());
      res?.ok
        ? setStat("googleTts", true, `연결 성공 (voices: ${res.voices})`)
        : setStat("googleTts", false, `실패: ${stringifyErr(res?.message)}`);
    } catch (e) {
      setStat("googleTts", false, `오류: ${e?.message || e}`);
    } finally {
      setBusy("googleTts", false);
    }
  };

  const testGemini = async () => {
    if (!geminiKey?.trim()) return setStat("gemini", false, "키 미입력");
    setBusy("gemini", true);
    setStat("gemini", false, "");
    try {
      const res = await window.api.testGemini?.(geminiKey.trim());
      res?.ok ? setStat("gemini", true, "연결 성공") : setStat("gemini", false, `실패: ${stringifyErr(res?.message)}`);
    } catch (e) {
      setStat("gemini", false, `오류: ${e?.message || e}`);
    } finally {
      setBusy("gemini", false);
    }
  };

  const services = [
    {
      key: "openai",
      name: "🧠 OpenAI",
      description: "GPT 모델을 사용한 텍스트 생성, 번역, 요약 등의 AI 기능",
      value: openaiKey,
      setValue: setOpenaiKey,
      placeholder: "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "OpenAI 플랫폼에서 발급받은 API 키를 입력하세요",
      onSave: saveOpenAI,
      onTest: testOpenAI,
      status: status.openai,
      loading: loading.openai,
    },
    {
      key: "anthropic",
      name: "🤖 Anthropic",
      description: "Claude 모델을 사용한 고급 대화형 AI 및 복잡한 추론 작업",
      value: anthropicKey,
      setValue: setAnthropicKey,
      placeholder: "sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "Anthropic Console에서 발급받은 API 키를 입력하세요",
      onSave: saveAnthropic,
      onTest: testAnthropic,
      status: status.anthropic,
      loading: loading.anthropic,
    },
    {
      key: "replicate",
      name: "🔁 Replicate",
      description: "다양한 AI 모델 호스팅 플랫폼 - 이미지 생성, 영상 처리 등",
      value: replicateKey,
      setValue: setReplicateKey,
      placeholder: "r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "Replicate 대시보드에서 생성한 API 토큰을 입력하세요",
      onSave: saveReplicate,
      onTest: testReplicate,
      status: status.replicate,
      loading: loading.replicate,
    },
    {
      key: "pexels",
      name: "🖼️ Pexels",
      description: "고품질 무료 스톡 사진 및 이미지 라이브러리 서비스",
      value: pexelsKey,
      setValue: setPexelsKey,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "Pexels API 페이지에서 발급받은 키를 입력하세요",
      onSave: savePexels,
      onTest: testPexels,
      status: status.pexels,
      loading: loading.pexels,
    },
    {
      key: "pixabay",
      name: "📦 Pixabay",
      description: "무료 이미지, 벡터, 동영상 리소스 제공 플랫폼",
      value: pixabayKey,
      setValue: setPixabayKey,
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "Pixabay API 설정에서 확인할 수 있는 API 키를 입력하세요",
      onSave: savePixabay,
      onTest: testPixabay,
      status: status.pixabay,
      loading: loading.pixabay,
    },
    {
      key: "googleTts",
      name: "🗣️ Google TTS",
      description: "고품질 인공 지능 기반 음성 합성 서비스",
      value: googleTtsKey,
      setValue: setGoogleTtsKey,
      placeholder: "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "Google Cloud Console에서 생성한 Text-to-Speech API 키를 입력하세요",
      onSave: saveGoogleTts,
      onTest: testGoogleTts,
      status: status.googleTts,
      loading: loading.googleTts,
    },
    {
      key: "gemini",
      name: "💎 Google Gemini",
      description: "구글의 최신 멀티모달 AI 모델 - 텍스트, 이미지, 코드 생성 및 분석",
      value: geminiKey,
      setValue: setGeminiKey,
      placeholder: "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "Google AI Studio에서 발급받은 Gemini API 키를 입력하세요",
      onSave: saveGemini,
      onTest: testGemini,
      status: status.gemini,
      loading: loading.gemini,
    },
  ];

  const getStatusBadge = (status) => {
    if (!status) {
      return (
        <Badge appearance="outline" color="subtle" icon={<ClockRegular />} className={s.statusBadge}>
          미테스트
        </Badge>
      );
    }

    if (status.ok === true) {
      return (
        <Badge appearance="tint" color="success" icon={<CheckmarkCircleRegular />} className={s.statusBadge}>
          연결됨
        </Badge>
      );
    }

    if (status.ok === false) {
      return (
        <Badge appearance="tint" color="danger" icon={<DismissCircleRegular />} className={s.statusBadge}>
          실패
        </Badge>
      );
    }

    return (
      <Badge appearance="tint" color="brand" icon={<SaveRegular />} className={s.statusBadge}>
        저장됨
      </Badge>
    );
  };

  return (
    <div className={containerStyles.container}>
      {/* Header */}
      <SettingsHeader
        icon="🔧"
        title="API 설정 및 외부 서비스 연결 관리"
        description={
          <>
            외부 서비스 API 키를 안전하게 저장하고 연결 상태를 확인할 수 있습니다.
            <br />각 서비스의 API 키를 입력한 후 테스트 버튼을 클릭하여 연결을 확인하세요.
          </>
        }
      />

      {/* Services Grid */}
      <div className={s.servicesGrid}>
        {services.map((service) => (
          <Card key={service.key} className={s.serviceCard}>
            <div className={s.cardHeader}>
              <div className={s.serviceInfo}>
                <div className={s.serviceName}>{service.name}</div>
                <Caption1 className={s.serviceDescription}>{service.description}</Caption1>
              </div>
              {getStatusBadge(service.status)}
            </div>

            <div className={s.inputSection}>
              <Field label="API Key" hint={service.hint} className={s.compactInput}>
                <Input
                  type="password"
                  value={service.value}
                  onChange={(_, data) => service.setValue(data.value)}
                  placeholder={service.placeholder}
                  contentBefore={<KeyRegular />}
                  size="small"
                />
              </Field>
            </div>

            <div className={s.actionRow}>
              <div className={s.actionButtons}>
                <Button appearance="secondary" icon={<SaveRegular />} onClick={service.onSave} className={s.compactButton} size="small">
                  저장
                </Button>
                <Button
                  appearance="primary"
                  icon={service.loading ? <Spinner size="tiny" /> : <BeakerRegular />}
                  disabled={service.loading}
                  onClick={service.onTest}
                  className={s.compactButton}
                  size="small"
                >
                  {service.loading ? "테스트 중..." : "테스트"}
                </Button>
              </div>
              {service.status?.ts && <div className={s.timestamp}>마지막 확인: {new Date(service.status.ts).toLocaleTimeString()}</div>}
            </div>

            {service.status?.msg && (
              <div className={mergeClasses(\n                s.statusMessage,\n                service.status.ok === false ? s.errorMessage : s.successMessage\n              )}>
                {service.status.ok ? <CheckmarkCircleRegular /> : <DismissCircleRegular />}
                <Caption1>{service.status.msg}</Caption1>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
