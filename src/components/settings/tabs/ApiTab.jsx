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
} from "@fluentui/react-components";
import {
  KeyRegular,
  BeakerRegular,
  SaveRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ClockRegular,
  FolderRegular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalXL),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXL),
    maxWidth: "1400px",
    margin: "0 auto",
  },

  header: {
    textAlign: "center",
    marginBottom: tokens.spacingVerticalXL,
  },

  headerTitle: {
    background: `linear-gradient(135deg, ${tokens.colorBrandForeground1} 0%, ${tokens.colorPaletteBlueForeground2} 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: tokens.spacingVerticalM,
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightBold,
  },

  headerDescription: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase400,
    maxWidth: "600px",
    margin: "0 auto",
    lineHeight: "1.6",
  },

  servicesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    ...shorthands.gap(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
    width: "100%",
  },

  serviceCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.padding(tokens.spacingVerticalXL),
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    overflow: "hidden",
    
    "&::before": {
      content: "''",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "4px",
      background: `linear-gradient(90deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackground2} 100%)`,
    },
    
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
      ...shorthands.borderColor(tokens.colorBrandStroke1),
    },
  },

  specialCard: {
    gridColumn: "1 / -1",
    maxWidth: "800px",
    margin: "0 auto",
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalL,
  },

  serviceInfo: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },

  serviceName: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },

  serviceDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    lineHeight: "1.4",
  },

  statusBadge: {
    flexShrink: 0,
  },

  inputSection: {
    marginBottom: tokens.spacingVerticalL,
  },

  actionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM,
  },

  actionButtons: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },

  statusMessage: {
    ...shorthands.padding(tokens.spacingVerticalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
    fontSize: tokens.fontSizeBase300,
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
    fontSize: tokens.fontSizeBase200,
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
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
});

export default function ApiTab() {
  const s = useStyles();

  // ===== 상태 =====
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [replicateKey, setReplicateKey] = useState("");
  const [pexelsKey, setPexelsKey] = useState("");
  const [pixabayKey, setPixabayKey] = useState("");
  const [googleTtsKey, setGoogleTtsKey] = useState("");
  const [imagen3ServiceAccount, setImagen3ServiceAccount] = useState("");

  const [status, setStatus] = useState({
    openai: null,
    anthropic: null,
    replicate: null,
    pexels: null,
    pixabay: null,
    googleTts: null,
    imagen3: null,
  });

  const [loading, setLoading] = useState({
    openai: false,
    anthropic: false,
    replicate: false,
    pexels: false,
    pixabay: false,
    googleTts: false,
    imagen3: false,
  });

  // ===== 초기 로드 =====
  useEffect(() => {
    (async () => {
      const [ok, ak, rk, gk, pxk, pbk, i3] = await Promise.all([
        window.api.getSecret("openaiKey"),
        window.api.getSecret("anthropicKey"),
        window.api.getSecret("replicateKey"),
        window.api.getSecret("googleTtsApiKey"),
        window.api.getSecret("pexelsApiKey"),
        window.api.getSecret("pixabayApiKey"),
        window.api.getSecret("imagen3ServiceAccount"),
      ]);
      setOpenaiKey(ok || "");
      setAnthropicKey(ak || "");
      setReplicateKey(rk || "");
      setGoogleTtsKey(gk || "");
      setPexelsKey(pxk || "");
      setPixabayKey(pbk || "");
      setImagen3ServiceAccount(i3 || "");
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
  const saveImagen3 = async () => {
    await saveSecret("imagen3ServiceAccount", imagen3ServiceAccount);
    setSaved("imagen3");
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

  const testImagen3 = async () => {
    if (!imagen3ServiceAccount?.trim()) return setStat("imagen3", false, "서비스 계정 미입력");
    setBusy("imagen3", true);
    setStat("imagen3", false, "");
    try {
      const res = await window.api.testImagen3?.(imagen3ServiceAccount.trim());
      res?.ok ? setStat("imagen3", true, "연결 성공") : setStat("imagen3", false, `실패: ${stringifyErr(res?.message)}`);
    } catch (e) {
      setStat("imagen3", false, `오류: ${e?.message || e}`);
    } finally {
      setBusy("imagen3", false);
    }
  };

  const handleFileUpload = () => {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = ".json";
    el.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => setImagen3ServiceAccount(ev.target.result);
        reader.readAsText(file);
      }
    };
    el.click();
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
    <div className={s.container}>
      {/* Header */}
      <div className={s.header}>
        <Title3 className={s.headerTitle}>🔧 API 설정 및 연결 관리</Title3>
        <Body2 className={s.headerDescription}>
          외부 서비스 API 키를 안전하게 저장하고 연결 상태를 확인할 수 있습니다. 
          각 서비스의 API 키를 입력한 후 테스트 버튼을 클릭하여 연결을 확인하세요.
        </Body2>
      </div>

      {/* Services Grid */}
      <div className={s.servicesGrid}>
        {services.map((service) => (
          <Card key={service.key} className={s.serviceCard}>
            <div className={s.cardHeader}>
              <div className={s.serviceInfo}>
                <div className={s.serviceName}>
                  {service.name}
                </div>
                <div className={s.serviceDescription}>
                  {service.description}
                </div>
              </div>
              {getStatusBadge(service.status)}
            </div>

            <div className={s.inputSection}>
              <Field label="API Key" hint={service.hint}>
                <Input
                  type="password"
                  value={service.value}
                  onChange={(_, data) => service.setValue(data.value)}
                  placeholder={service.placeholder}
                  contentBefore={<KeyRegular />}
                />
              </Field>
            </div>

            <div className={s.actionRow}>
              <div className={s.actionButtons}>
                <Button appearance="secondary" icon={<SaveRegular />} onClick={service.onSave}>
                  저장
                </Button>
                <Button
                  appearance="primary"
                  icon={service.loading ? <Spinner size="tiny" /> : <BeakerRegular />}
                  disabled={service.loading}
                  onClick={service.onTest}
                >
                  {service.loading ? "테스트 중..." : "테스트"}
                </Button>
              </div>
              {service.status?.ts && (
                <Caption1 className={s.timestamp}>
                  마지막 확인: {new Date(service.status.ts).toLocaleTimeString()}
                </Caption1>
              )}
            </div>

            {service.status?.msg && (
              <div className={`${s.statusMessage} ${service.status.ok === false ? s.errorMessage : s.successMessage}`}>
                {service.status.ok ? <CheckmarkCircleRegular /> : <DismissCircleRegular />}
                <Body2>{service.status.msg}</Body2>
              </div>
            )}
          </Card>
        ))}

        {/* Google Imagen3 - Special Card */}
        <Card className={`${s.serviceCard} ${s.specialCard}`}>
          <div className={s.cardHeader}>
            <div className={s.serviceInfo}>
              <div className={s.serviceName}>
                🎨 Google Imagen3
              </div>
              <div className={s.serviceDescription}>
                구글의 최신 AI 이미지 생성 모델 - 텍스트에서 고품질 이미지 생성
              </div>
            </div>
            {getStatusBadge(status.imagen3)}
          </div>

          <div className={s.textareaField}>
            <Field 
              label="서비스 계정 JSON" 
              hint="Google Cloud Console에서 생성한 서비스 계정의 JSON 키 파일 내용"
            >
              <Textarea
                value={imagen3ServiceAccount}
                onChange={(_, data) => setImagen3ServiceAccount(data.value)}
                placeholder='{\n  "type": "service_account",\n  "project_id": "your-project-id",\n  "private_key_id": "...",\n  ...\n}'
                rows={8}
                resize="vertical"
              />
            </Field>
          </div>

          <div className={s.fileActions}>
            <Button
              appearance="subtle"
              icon={<FolderRegular />}
              onClick={handleFileUpload}
            >
              JSON 파일 선택
            </Button>
            
            <div className={s.actionButtons}>
              <Button appearance="secondary" icon={<SaveRegular />} onClick={saveImagen3}>
                저장
              </Button>
              <Button
                appearance="primary"
                icon={loading.imagen3 ? <Spinner size="tiny" /> : <BeakerRegular />}
                disabled={loading.imagen3}
                onClick={testImagen3}
              >
                {loading.imagen3 ? "테스트 중..." : "테스트"}
              </Button>
            </div>
          </div>

          {status.imagen3?.ts && (
            <div style={{ textAlign: "right", marginTop: tokens.spacingVerticalM }}>
              <Caption1 className={s.timestamp}>
                마지막 확인: {new Date(status.imagen3.ts).toLocaleTimeString()}
              </Caption1>
            </div>
          )}

          {status.imagen3?.msg && (
            <div className={`${s.statusMessage} ${status.imagen3.ok === false ? s.errorMessage : s.successMessage}`}>
              {status.imagen3.ok ? <CheckmarkCircleRegular /> : <DismissCircleRegular />}
              <Body2>{status.imagen3.msg}</Body2>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}