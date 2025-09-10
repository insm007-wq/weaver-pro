/**
 * 폼 필드 공통 컴포넌트
 * 
 * @description
 * 다양한 폼 입력 요소를 통합적으로 관리하는 재사용 가능한 컴포넌트
 * 라벨, 검증, 오류 메시지, 도움말을 포함한 완전한 폼 필드를 제공합니다.
 * 
 * @features
 * - 📝 다양한 입력 타입 지원 (text, textarea, select, file 등)
 * - ✅ 실시간 검증 및 오류 표시
 * - 🎨 Fluent UI 디자인 시스템 기반
 * - 📱 반응형 레이아웃 지원
 * - 🔧 고도로 커스터마이징 가능
 * 
 * @example
 * ```jsx
 * import { FormField } from '../components/common/FormField';
 * 
 * // 텍스트 입력
 * <FormField
 *   label="이름"
 *   type="text"
 *   value={name}
 *   onChange={(value) => setName(value)}
 *   required
 * />
 * 
 * // 셀렉트 박스
 * <FormField
 *   label="카테고리"
 *   type="select"
 *   value={category}
 *   onChange={(value) => setCategory(value)}
 *   options={[
 *     { value: 'option1', label: '옵션 1' },
 *     { value: 'option2', label: '옵션 2' }
 *   ]}
 * />
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React, { useCallback, useState, useId } from 'react';
import {
  makeStyles,
  tokens,
  Field,
  Input,
  Textarea,
  Dropdown,
  Option,
  Label,
  Text,
  Button
} from '@fluentui/react-components';
import { 
  EyeRegular, 
  EyeOffRegular, 
  FolderOpenRegular,
  InfoRegular,
  ErrorCircleRegular,
  CheckmarkCircleRegular
} from '@fluentui/react-icons';

// =========================== 스타일 정의 ===========================

const useStyles = makeStyles({
  /** 폼 필드 컨테이너 */
  fieldContainer: {
    marginBottom: tokens.spacingVerticalM,
  },

  /** 라벨 영역 */
  labelContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    marginBottom: tokens.spacingVerticalXS,
  },

  /** 필수 표시 */
  required: {
    color: tokens.colorPaletteRedForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },

  /** 입력 컨테이너 (아이콘 포함) */
  inputContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },

  /** 패스워드 토글 버튼 */
  passwordToggle: {
    position: 'absolute',
    right: tokens.spacingHorizontalS,
    zIndex: 1,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: tokens.spacingVerticalXS,
    borderRadius: tokens.borderRadiusSmall,
    color: tokens.colorNeutralForeground2,
    
    ':hover': {
      color: tokens.colorNeutralForeground1,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  /** 파일 선택 버튼 */
  fileButton: {
    marginLeft: tokens.spacingHorizontalS,
    minWidth: 'auto',
  },

  /** 파일 숨김 입력 */
  hiddenFileInput: {
    display: 'none',
  },

  /** 도움말 텍스트 */
  helpText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXS,
    lineHeight: '1.3',
  },

  /** 오류 메시지 */
  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorPaletteRedForeground1,
    marginTop: tokens.spacingVerticalXS,
  },

  /** 성공 메시지 */
  successMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorPaletteGreenForeground1,
    marginTop: tokens.spacingVerticalXS,
  },

  /** 검증 아이콘 */
  validationIcon: {
    fontSize: tokens.fontSizeBase200,
  },

  /** 인라인 레이아웃 */
  inline: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,

    '& .field-label': {
      marginBottom: 0,
      minWidth: '120px',
    },

    '& .field-input': {
      flex: 1,
    },
  },

  /** 그리드 레이아웃 */
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },
});

// =========================== 메인 컴포넌트 ===========================

/**
 * 폼 필드 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {string} props.label - 필드 라벨
 * @param {"text"|"password"|"email"|"number"|"textarea"|"select"|"file"} [props.type="text"] - 입력 타입
 * @param {any} props.value - 현재 값
 * @param {Function} props.onChange - 값 변경 핸들러
 * @param {Function} [props.onBlur] - 포커스 아웃 핸들러
 * @param {string} [props.placeholder] - 플레이스홀더 텍스트
 * @param {boolean} [props.required=false] - 필수 여부
 * @param {boolean} [props.disabled=false] - 비활성화 여부
 * @param {string} [props.error] - 오류 메시지
 * @param {string} [props.success] - 성공 메시지
 * @param {string} [props.helpText] - 도움말 텍스트
 * @param {Array} [props.options] - 셀렉트 옵션 (select 타입인 경우)
 * @param {string} [props.accept] - 허용 파일 타입 (file 타입인 경우)
 * @param {"default"|"inline"|"grid"} [props.layout="default"] - 레이아웃 스타일
 * @param {Object} [props.inputProps] - 입력 요소에 전달할 추가 속성들
 * @param {string} [props.className] - 추가 CSS 클래스
 * @returns {JSX.Element} 폼 필드 컴포넌트
 */
export function FormField({
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  disabled = false,
  error,
  success,
  helpText,
  options = [],
  accept,
  layout = 'default',
  inputProps = {},
  className,
  ...props
}) {
  const styles = useStyles();
  const fieldId = useId();
  const [showPassword, setShowPassword] = useState(false);

  // 패스워드 표시/숨김 토글
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (file && onChange) {
      onChange(file);
    }
  }, [onChange]);

  // 드롭다운 변경 핸들러
  const handleDropdownChange = useCallback((event, data) => {
    if (onChange) {
      onChange(data.optionValue);
    }
  }, [onChange]);

  // 기본 입력 변경 핸들러
  const handleInputChange = useCallback((event) => {
    if (onChange) {
      const newValue = type === 'number' 
        ? parseFloat(event.target.value) || 0
        : event.target.value;
      onChange(newValue);
    }
  }, [onChange, type]);

  // 입력 요소 렌더링
  const renderInput = () => {
    const commonProps = {
      id: fieldId,
      value: value || '',
      placeholder,
      disabled,
      onBlur,
      ...inputProps,
    };

    switch (type) {
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            onChange={handleInputChange}
            resize="vertical"
          />
        );

      case 'select':
        return (
          <Dropdown
            {...commonProps}
            value={value}
            onOptionSelect={handleDropdownChange}
            placeholder={placeholder || `${label} 선택`}
          >
            {options.map((option) => (
              <Option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </Option>
            ))}
          </Dropdown>
        );

      case 'file':
        return (
          <div className={styles.inputContainer}>
            <Input
              {...commonProps}
              readOnly
              value={value?.name || value || ''}
              placeholder={placeholder || '파일을 선택하세요'}
            />
            <input
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              className={styles.hiddenFileInput}
              id={`${fieldId}-file`}
              disabled={disabled}
            />
            <Button
              as="label"
              htmlFor={`${fieldId}-file`}
              appearance="secondary"
              size="small"
              icon={<FolderOpenRegular />}
              className={styles.fileButton}
              disabled={disabled}
            >
              찾아보기
            </Button>
          </div>
        );

      case 'password':
        return (
          <div className={styles.inputContainer}>
            <Input
              {...commonProps}
              type={showPassword ? 'text' : 'password'}
              onChange={handleInputChange}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={togglePasswordVisibility}
              disabled={disabled}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffRegular /> : <EyeRegular />}
            </button>
          </div>
        );

      default:
        return (
          <Input
            {...commonProps}
            type={type}
            onChange={handleInputChange}
          />
        );
    }
  };

  // 라벨 렌더링
  const renderLabel = () => (
    <div className={`${styles.labelContainer} field-label`}>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      {required && <span className={styles.required}>*</span>}
    </div>
  );

  // 도움말 및 메시지 렌더링
  const renderMessages = () => (
    <>
      {helpText && !error && !success && (
        <Text className={styles.helpText}>
          <InfoRegular className={styles.validationIcon} />
          {helpText}
        </Text>
      )}
      
      {error && (
        <Text className={styles.errorMessage}>
          <ErrorCircleRegular className={styles.validationIcon} />
          {error}
        </Text>
      )}
      
      {success && !error && (
        <Text className={styles.successMessage}>
          <CheckmarkCircleRegular className={styles.validationIcon} />
          {success}
        </Text>
      )}
    </>
  );

  // 레이아웃에 따른 렌더링
  const getContainerClass = () => {
    const classes = [styles.fieldContainer];
    
    if (layout === 'inline') classes.push(styles.inline);
    if (layout === 'grid') classes.push(styles.grid);
    if (className) classes.push(className);
    
    return classes.join(' ');
  };

  return (
    <div className={getContainerClass()} {...props}>
      {renderLabel()}
      <div className="field-input">
        {renderInput()}
        {renderMessages()}
      </div>
    </div>
  );
}

// =========================== 특화된 폼 필드 컴포넌트들 ===========================

/**
 * 텍스트 입력 필드
 */
export function TextField(props) {
  return <FormField type="text" {...props} />;
}

/**
 * 패스워드 입력 필드
 */
export function PasswordField(props) {
  return <FormField type="password" {...props} />;
}

/**
 * 이메일 입력 필드
 */
export function EmailField(props) {
  return (
    <FormField
      type="email"
      placeholder="example@email.com"
      {...props}
    />
  );
}

/**
 * 숫자 입력 필드
 */
export function NumberField({ min, max, step, ...props }) {
  return (
    <FormField
      type="number"
      inputProps={{ min, max, step }}
      {...props}
    />
  );
}

/**
 * 텍스트에어리어 필드
 */
export function TextareaField({ rows = 4, ...props }) {
  return (
    <FormField
      type="textarea"
      inputProps={{ rows }}
      {...props}
    />
  );
}

/**
 * 셀렉트 필드
 */
export function SelectField({ options, ...props }) {
  return (
    <FormField
      type="select"
      options={options}
      {...props}
    />
  );
}

/**
 * 파일 선택 필드
 */
export function FileField({ accept, multiple, ...props }) {
  return (
    <FormField
      type="file"
      accept={accept}
      inputProps={{ multiple }}
      {...props}
    />
  );
}

// =========================== 폼 필드 그룹 컴포넌트 ===========================

/**
 * 폼 필드들을 그룹화하는 컨테이너 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {string} [props.title] - 그룹 제목
 * @param {string} [props.description] - 그룹 설명
 * @param {React.ReactNode} props.children - 폼 필드들
 * @param {"default"|"card"|"section"} [props.variant="default"] - 그룹 스타일
 * @returns {JSX.Element} 폼 필드 그룹
 */
export function FormFieldGroup({ 
  title, 
  description, 
  children, 
  variant = 'default',
  ...props 
}) {
  const styles = useStyles();

  const groupStyles = {
    default: {},
    card: {
      backgroundColor: tokens.colorNeutralBackground1,
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusLarge,
      padding: tokens.spacingVerticalL,
      marginBottom: tokens.spacingVerticalL,
    },
    section: {
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
      paddingBottom: tokens.spacingVerticalL,
      marginBottom: tokens.spacingVerticalL,
    },
  };

  return (
    <div style={groupStyles[variant]} {...props}>
      {title && (
        <Text
          as="h3"
          style={{
            fontSize: tokens.fontSizeBase400,
            fontWeight: tokens.fontWeightSemibold,
            marginBottom: tokens.spacingVerticalS,
            color: tokens.colorNeutralForeground1,
          }}
        >
          {title}
        </Text>
      )}
      
      {description && (
        <Text
          style={{
            fontSize: tokens.fontSizeBase300,
            color: tokens.colorNeutralForeground2,
            marginBottom: tokens.spacingVerticalM,
            lineHeight: '1.4',
          }}
        >
          {description}
        </Text>
      )}
      
      {children}
    </div>
  );
}

export default FormField;