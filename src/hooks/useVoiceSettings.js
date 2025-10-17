/**
 * TTS 음성 설정 관리를 위한 커스텀 훅
 * 
 * @description
 * TTS 엔진(Google)의 음성 목록을 로드하고 관리하는 훅
 * 음성 미리듣기, 음성 필터링, 오류 처리 등의 기능을 제공합니다.
 * 
 * @features
 * - 🎤 TTS 엔진별 음성 목록 로드 (Google TTS)
 * - 🔄 엔진 변경 시 자동 음성 재로드
 * - 🎵 음성 미리듣기 기능
 * - 🎯 음성 필터링 및 추천 음성 우선 표시
 * - 🛡️ API 오류 처리 및 재시도 기능
 * - 📊 로딩/오류 상태 관리
 * 
 * @example
 * ```jsx
 * import { useVoiceSettings } from './hooks/useVoiceSettings';
 * 
 * function VoiceSelector({ form }) {
 *   const { 
 *     voices, 
 *     voiceLoading, 
 *     voiceError, 
 *     previewVoice, 
 *     retryVoiceLoad 
 *   } = useVoiceSettings(form);
 *   
 *   if (voiceLoading) return <Spinner />;
 *   if (voiceError) return <ErrorMessage onRetry={retryVoiceLoad} />;
 *   
 *   return (
 *     <Select>
 *       {voices.map(voice => (
 *         <Option key={voice.id} value={voice.id}>
 *           {voice.name}
 *           <Button onClick={() => previewVoice(voice.id, voice.name)}>
 *             미리듣기
 *           </Button>
 *         </Option>
 *       ))}
 *     </Select>
 *   );
 * }
 * ```
 * 
 * @usage
 * - ScriptVoiceGenerator.jsx: TTS 음성 선택 및 미리듣기
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useState, useEffect, useCallback } from "react";
import { useApi } from "./useApi";

/**
 * TTS 음성 설정 관리 훅
 * 
 * @param {Object} form - 폼 상태 객체 (ttsEngine 필드 필수)
 * @param {string} form.ttsEngine - 사용할 TTS 엔진 ('google')
 * @param {string} [form.speed] - 음성 속도 설정 (미리듣기용)
 * @returns {Object} 음성 관련 상태와 함수들
 * @returns {Array} returns.voices - 사용 가능한 음성 목록
 * @returns {boolean} returns.voiceLoading - 음성 목록 로딩 중 여부
 * @returns {Object|null} returns.voiceError - 음성 로딩 오류 정보
 * @returns {Function} returns.previewVoice - 음성 미리듣기 함수 (voiceId, voiceName)
 * @returns {Function} returns.retryVoiceLoad - 음성 목록 재로드 함수
 */
export function useVoiceSettings(form) {
  const api = useApi();

  const [voices, setVoices] = useState([]);
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [voiceError, setVoiceError] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);

  // 초기 목소리 로드
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialVoices = async () => {
      if (!form.ttsEngine) return;
      
      try {
        setVoiceLoading(true);
        setVoiceError(null);

        const res = await api.invoke("tts:listVoices", { engine: form.ttsEngine });

        if (isMounted && (res?.ok || res?.success)) {
          const allItems = Array.isArray(res.data) ? res.data : [];
          const filteredItems = filterVoicesByEngine(allItems, form.ttsEngine);
          setVoices(filteredItems);
        } else if (isMounted) {
          setVoiceError({
            code: res?.code ?? res?.errorCode ?? 1004,
            message: res?.message ?? "TTS API 키를 확인해주세요.",
          });
        }
      } catch (e) {
        if (isMounted) {
          setVoiceError({
            code: e?.code ?? e?.status ?? 1004,
            message: e?.message ?? "TTS API 연결에 실패했습니다.",
          });
        }
      } finally {
        if (isMounted) setVoiceLoading(false);
      }
    };

    loadInitialVoices();

    return () => {
      isMounted = false;
    };
  }, []);

  // TTS 엔진 변경 시 목소리 다시 로드
  useEffect(() => {
    if (!form.ttsEngine) return;
    
    let isMounted = true;
    
    const reloadVoices = async () => {
      try {
        setVoiceLoading(true);
        setVoiceError(null);

        const res = await api.invoke("tts:listVoices", { engine: form.ttsEngine });

        if (isMounted && (res?.ok || res?.success)) {
          const allItems = Array.isArray(res.data) ? res.data : [];
          const filteredItems = filterVoicesByEngine(allItems, form.ttsEngine);
          setVoices(filteredItems);
        } else if (isMounted) {
          setVoiceError({
            code: res?.code ?? res?.errorCode ?? 1004,
            message: res?.message ?? "TTS API 키를 확인해주세요.",
          });
        }
      } catch (e) {
        if (isMounted) {
          setVoiceError({
            code: e?.code ?? e?.status ?? 1004,
            message: e?.message ?? "TTS API 연결에 실패했습니다.",
          });
        }
      } finally {
        if (isMounted) setVoiceLoading(false);
      }
    };

    reloadVoices();

    return () => {
      isMounted = false;
    };
  }, [form.ttsEngine]);

  const filterVoicesByEngine = (allItems, engine) => {
    switch (engine) {
      case "google":
        // Google TTS: Wavenet만 사용 (Neural2 제외), 남자 2개, 여자 2개만 선택
        const googleVoices = allItems.filter(
          (voice) => voice.provider === "Google" && voice.type === "Wavenet"
        );

        // 성별로 분류
        const maleVoices = googleVoices.filter(v => v.gender === "MALE").slice(0, 2);
        const femaleVoices = googleVoices.filter(v => v.gender === "FEMALE").slice(0, 2);

        return [...femaleVoices, ...maleVoices];

      // 향후 추가될 TTS 엔진들
      // case "amazon":
      //   return allItems.filter((voice) => voice.provider === "Amazon");
      // case "kt":
      //   return allItems.filter((voice) => voice.provider === "KT");

      default:
        // 기타 엔진: 모든 음성 반환
        return allItems;
    }
  };

  const previewVoice = useCallback(async (voiceId, voiceName) => {
    try {
      // 이전 오디오가 있으면 먼저 중지
      setCurrentAudio((prevAudio) => {
        if (prevAudio) {
          prevAudio.pause();
          prevAudio.currentTime = 0;
        }
        return null;
      });

      const sampleText = "안녕하세요. 이것은 목소리 미리듣기 샘플입니다. 자연스럽고 명확한 발음으로 한국어를 읽어드립니다.";
      const payload = {
        doc: { scenes: [{ text: sampleText }] },
        tts: {
          engine: form.ttsEngine,
          voiceId: voiceId,
          voiceName: voiceName,
          speakingRate: form.speed || "1.0",
          provider: "Google",
        },
      };

      const res = await api.invoke("tts/synthesizeByScenes", payload);
      if (res?.success && res?.data?.parts?.length > 0) {
        const audioBlob = new Blob([Uint8Array.from(atob(res.data.parts[0].base64), (c) => c.charCodeAt(0))], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        setCurrentAudio(audio);
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
        };

        audio.play().catch((err) => {
          console.error("오디오 재생 실패:", err);
          console.error("목소리 미리듣기 재생에 실패했습니다.");
          setCurrentAudio(null);
        });
      } else {
        throw new Error(res?.error || res?.data?.message || "음성 합성 실패");
      }
    } catch (error) {
      console.error("목소리 미리듣기 실패:", error);
      console.error("목소리 미리듣기에 실패했습니다.");
    }
  }, [form.ttsEngine, form.speed, api]);

  const stopVoice = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
  }, [currentAudio]);

  const retryVoiceLoad = useCallback(async () => {
    try {
      setVoiceLoading(true);
      setVoiceError(null);
      const res = await api.invoke("tts:listVoices", { engine: form.ttsEngine });
      if (res?.ok || res?.success) {
        const allItems = Array.isArray(res.data) ? res.data : [];
        const filteredItems = filterVoicesByEngine(allItems, form.ttsEngine);
        setVoices(filteredItems);
      } else {
        setVoiceError({
          code: res?.code ?? res?.errorCode ?? 1004,
          message: res?.message ?? "API 키가 올바르지 않거나 설정되지 않았습니다.",
        });
      }
    } catch (e) {
      setVoiceError({
        code: e?.code ?? 1004,
        message: e?.message ?? "API 연결에 실패했습니다.",
      });
    } finally {
      setVoiceLoading(false);
    }
  }, [form.ttsEngine]);

  return {
    voices,
    voiceLoading,
    voiceError,
    previewVoice,
    stopVoice,
    retryVoiceLoad,
  };
}