/**
 * 공통 컴포넌트 개별 Export (Tree-shaking 최적화)
 * 
 * @description
 * 각 컴포넌트를 개별적으로 import 할 수 있도록 export합니다.
 * 번들 크기 최적화를 위해 tree-shaking을 활용합니다.
 * 
 * @usage
 * // ✅ 개별 import (권장)
 * import { StandardCard } from '@/components/common';
 * import { PrimaryButton, LoadingSpinner } from '@/components/common';
 * 
 * // ✅ 직접 import (더 명확한 의존성)
 * import StandardCard from '@/components/common/StandardCard';
 * import { PrimaryButton } from '@/components/common/ActionButton';
 * 
 * @author Weaver Pro Team
 * @version 2.0.0
 */

// =========================== 개별 Export (Tree-shaking 지원) ===========================

// 카드 컴포넌트
export { default as StandardCard } from './StandardCard';

// 로딩 컴포넌트들
export { 
  default as LoadingSpinner,
  PageLoading,
  InlineLoading,
  OverlayLoading,
  ButtonLoading,
  CardLoading,
  LoadingWrapper,
  LoadingOverlay
} from './LoadingSpinner';

// 상태 배지 컴포넌트들
export { 
  default as StatusBadge,
  SuccessBadge,
  WarningBadge,
  ErrorBadge,
  InfoBadge,
  PendingBadge,
  OnlineBadge,
  OfflineBadge,
  ProgressBadge,
  CountBadge
} from './StatusBadge';

// 버튼 컴포넌트들
export { 
  default as ActionButton,
  PrimaryButton,
  SecondaryButton,
  SuccessButton,
  DangerButton,
  BrandButton,
  OutlineButton,
  TextButton,
  IconButton,
  FloatingActionButton,
  LoadingButton,
  SubmitButton,
  CancelButton,
  SaveButton,
  DeleteButton
} from './ActionButton';

// 폼 컴포넌트들
export { 
  default as FormField,
  TextField,
  PasswordField,
  EmailField,
  NumberField,
  TextareaField,
  SelectField,
  FileField,
  FormFieldGroup
} from './FormField';

export { 
  default as FormSection,
  CardSection,
  DividerSection,
  CompactSection,
  SpaciousSection,
  GridSection,
  TwoColumnSection,
  SettingsSection
} from './FormSection';

// 헤더 컴포넌트들
export { 
  default as PageHeader,
  CompactPageHeader,
  NoDividerPageHeader
} from './PageHeader';

export { default as SettingsHeader } from './SettingsHeader';

// 진행률 컴포넌트들
export { 
  default as ProgressIndicator,
  CircularProgress,
  StepsProgress,
  SimpleProgress,
  UploadProgress
} from './ProgressIndicator';

// 기존 컴포넌트들 (유지)
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as KeepAlivePane } from './KeepAlivePane';
export { default as ProgressDonut } from './ProgressDonut';

// 토스트 컴포넌트
export { default as GlobalToast, showGlobalToast, hideGlobalToast } from './GlobalToast';

