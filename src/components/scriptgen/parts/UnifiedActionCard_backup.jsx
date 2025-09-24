// 백업용 - 설명 영역에 배경 추가
        {/* 설명 영역 (ModeSelector와 동일) */}
        <div
          style={{
            marginTop: tokens.spacingVerticalS,
            padding: tokens.spacingVerticalS,
            background: "rgba(255,255,255,0.1)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text size={200} style={{ color: "rgba(255,255,255,0.95)" }}>
            {currentMode.description}
          </Text>
        </div>