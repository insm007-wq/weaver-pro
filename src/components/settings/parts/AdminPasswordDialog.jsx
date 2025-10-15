import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Input,
  Field,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { LockClosedRegular, DismissRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  dialogSurface: {
    maxWidth: "400px",
  },
  inputField: {
    marginTop: tokens.spacingVerticalM,
  },
  errorMessage: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
    marginTop: tokens.spacingVerticalXS,
  },
});

/**
 * 관리자 비밀번호 인증 다이얼로그
 * @param {boolean} open - 다이얼로그 표시 여부
 * @param {function} onClose - 닫기 콜백
 * @param {function} onSuccess - 인증 성공 콜백
 */
export default function AdminPasswordDialog({ open, onClose, onSuccess }) {
  const styles = useStyles();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    // 하드코딩된 비밀번호 확인
    if (password === "2345") {
      setError("");
      setPassword("");
      onSuccess?.();
      onClose?.();
    } else {
      setError("비밀번호가 올바르지 않습니다.");
      setPassword("");
    }
  };

  const handleCancel = () => {
    setPassword("");
    setError("");
    onClose?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && handleCancel()}>
      <DialogSurface className={styles.dialogSurface}>
        <DialogBody>
          <DialogTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LockClosedRegular />
              관리자 인증
            </div>
          </DialogTitle>
          <DialogContent>
            <Field
              label="비밀번호"
              validationMessage={error}
              validationState={error ? "error" : undefined}
              className={styles.inputField}
            >
              <Input
                type="password"
                value={password}
                onChange={(_, data) => {
                  setPassword(data.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="관리자 비밀번호를 입력하세요"
                autoFocus
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" icon={<DismissRegular />} onClick={handleCancel}>
              취소
            </Button>
            <Button appearance="primary" icon={<LockClosedRegular />} onClick={handleSubmit}>
              확인
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
