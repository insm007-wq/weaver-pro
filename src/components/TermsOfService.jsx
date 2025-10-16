import { useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Button,
  Text,
  Title1,
  Title2,
  Subtitle1,
  Body1,
  Card,
  Checkbox,
  mergeClasses,
} from "@fluentui/react-components";
import { CheckmarkCircle24Regular, DocumentText24Regular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalXXL),
  },
  card: {
    maxWidth: "700px",
    width: "100%",
    ...shorthands.padding(tokens.spacingVerticalXXXL, tokens.spacingHorizontalXXXL),
    boxShadow: tokens.shadow64,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
  },
  header: {
    textAlign: "center",
    marginBottom: tokens.spacingVerticalXXL,
  },
  logoBox: {
    width: "80px",
    height: "80px",
    margin: "0 auto",
    marginBottom: tokens.spacingVerticalL,
    backgroundImage: `linear-gradient(135deg, ${tokens.colorBrandBackground}, ${tokens.colorBrandBackground2})`,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: "40px",
    boxShadow: tokens.shadow16,
  },
  companyInfo: {
    textAlign: "center",
    marginBottom: tokens.spacingVerticalXL,
    ...shorthands.padding(tokens.spacingVerticalL),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  termsContent: {
    marginBottom: tokens.spacingVerticalXL,
    maxHeight: "400px",
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    fontSize: tokens.fontSizeBase300,
    lineHeight: "1.8",
  },
  section: {
    marginBottom: tokens.spacingVerticalL,
  },
  sectionTitle: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalS,
  },
  checkboxContainer: {
    display: "flex",
    alignItems: "flex-start",
    ...shorthands.gap(tokens.spacingHorizontalM),
    ...shorthands.padding(tokens.spacingVerticalL),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("2px", "solid", tokens.colorNeutralStroke2),
    marginBottom: tokens.spacingVerticalXL,
    transition: "all 0.3s ease",
    "&:hover": {
      ...shorthands.borderColor(tokens.colorBrandStroke1),
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  checkboxContainerChecked: {
    ...shorthands.borderColor(tokens.colorBrandBackground),
    backgroundColor: tokens.colorBrandBackground2,
  },
  checkboxLabel: {
    flex: 1,
    cursor: "pointer",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  acceptButton: {
    minWidth: "200px",
  },
  footer: {
    textAlign: "center",
    marginTop: tokens.spacingVerticalXL,
    color: tokens.colorNeutralForeground3,
  },
});

export default function TermsOfService({ onAccept }) {
  const [isChecked, setIsChecked] = useState(false);
  const styles = useStyles();

  const handleAccept = () => {
    if (isChecked && onAccept) {
      onAccept();
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.logoBox}>🎬</div>
          <Title1>Weaver Pro</Title1>
          <Subtitle1>AI 영상 제작 솔루션</Subtitle1>
        </div>

        {/* 회사 정보 */}
        <div className={styles.companyInfo}>
          <Title2>애유미</Title2>
        </div>

        {/* 약관 내용 */}
        <div className={styles.termsContent}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <DocumentText24Regular /> 서비스 이용약관
            </div>
            <Text>
              본 약관은 애유미(이하 "회사")가 제공하는 Weaver Pro 소프트웨어(이하 "서비스")의 이용과 관련하여 회사와 이용자의 권리, 의무 및
              책임사항을 규정합니다.
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제1조 (목적)</div>
            <Text>
              본 약관은 회사가 제공하는 AI 기반 영상 제작 서비스의 이용조건 및 절차, 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을
              목적으로 합니다.
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제2조 (정의)</div>
            <Text as="div">
              1. "서비스"란 Weaver Pro 소프트웨어를 통해 제공되는 AI 영상 제작 도구를 의미합니다.
              <br />
              2. "이용자"란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 자를 의미합니다.
              <br />
              3. "콘텐츠"란 이용자가 서비스를 통해 생성한 영상, 음성, 이미지 등을 의미합니다.
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제3조 (서비스의 제공)</div>
            <Text as="div">
              1. 회사는 다음과 같은 서비스를 제공합니다:
              <br />
              　• AI 기반 대본 생성
              <br />
              　• 음성 합성 (TTS)
              <br />
              　• 이미지 및 영상 생성
              <br />
              　• 영상 편집 및 합성
              <br />
              2. 서비스는 연중무휴 24시간 제공을 원칙으로 하나, 시스템 점검 등의 사유로 중단될 수 있습니다.
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제4조 (이용자의 의무)</div>
            <Text as="div">
              이용자는 다음 행위를 하여서는 안 됩니다:
              <br />
              1. 타인의 지적재산권을 침해하는 콘텐츠 생성
              <br />
              2. 불법적이거나 유해한 콘텐츠 제작
              <br />
              3. 서비스의 정상적인 운영을 방해하는 행위
              <br />
              4. 회사의 사전 승인 없이 서비스를 영리 목적으로 사용하는 행위
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제5조 (개인정보 보호)</div>
            <Text>
              회사는 관련 법령에 따라 이용자의 개인정보를 보호하며, 개인정보의 수집, 이용, 제공 등은 별도의 개인정보 처리방침에 따릅니다.
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제6조 (콘텐츠의 저작권)</div>
            <Text>
              1. 이용자가 서비스를 통해 생성한 콘텐츠의 저작권은 이용자에게 귀속됩니다.
              <br />
              2. 단, AI가 생성한 콘텐츠의 경우 각 AI 서비스 제공자의 약관을 따릅니다.
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제7조 (면책조항)</div>
            <Text>
              1. 회사는 천재지변, 시스템 장애 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.
              <br />
              2. 회사는 이용자가 생성한 콘텐츠의 적법성, 정확성에 대해 책임지지 않습니다.
              <br />
              3. 회사는 외부 API 서비스의 장애 또는 중단에 대해 책임지지 않습니다.
            </Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제8조 (약관의 변경)</div>
            <Text>회사는 필요한 경우 본 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지를 통해 고지됩니다.</Text>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>제9조 (문의 및 분쟁 해결)</div>
            <Text>서비스 이용과 관련한 문의사항이나 분쟁이 발생한 경우, 회사의 고객지원 채널을 통해 해결할 수 있습니다.</Text>
          </div>

          <div className={styles.section} style={{ marginTop: tokens.spacingVerticalXL }}>
            <Text weight="semibold">본 약관은 2025년 1월 16일부터 시행됩니다.</Text>
          </div>
        </div>

        {/* 동의 체크박스 */}
        <div className={mergeClasses(styles.checkboxContainer, isChecked && styles.checkboxContainerChecked)}>
          <Checkbox checked={isChecked} onChange={(e, data) => setIsChecked(data.checked)} />
          <div className={styles.checkboxLabel} onClick={() => setIsChecked(!isChecked)}>
            <Text weight="semibold" size={400}>
              위 서비스 이용약관을 모두 읽었으며, 이에 동의합니다.
            </Text>
            <Text size={200} style={{ marginTop: tokens.spacingVerticalXS, color: tokens.colorNeutralForeground3 }}>
              동의하지 않으시면 서비스를 이용하실 수 없습니다.
            </Text>
          </div>
        </div>

        {/* 버튼 */}
        <div className={styles.buttonContainer}>
          <Button
            appearance="primary"
            size="large"
            disabled={!isChecked}
            onClick={handleAccept}
            className={styles.acceptButton}
            icon={<CheckmarkCircle24Regular />}
          >
            동의하고 시작하기
          </Button>
        </div>

        {/* 푸터 */}
        <div className={styles.footer}>
          <Text size={200}>© 2025 애유미 All rights reserved.</Text>
        </div>
      </Card>
    </div>
  );
}
