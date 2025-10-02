const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Weaver Pro 아이콘 SVG (비디오 편집 심볼)
const iconSVG = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- 배경 라운드 사각형 -->
  <rect width="512" height="512" rx="100" fill="url(#grad)"/>

  <!-- 비디오 프레임 -->
  <rect x="96" y="140" width="320" height="232" rx="16" fill="white" opacity="0.95"/>

  <!-- 재생 버튼 (삼각형) -->
  <path d="M 200 210 L 200 310 L 290 260 Z" fill="#6366f1"/>

  <!-- 타임라인 바 -->
  <rect x="120" y="400" width="272" height="16" rx="8" fill="white" opacity="0.9"/>
  <rect x="120" y="400" width="160" height="16" rx="8" fill="#f59e0b"/>

  <!-- 편집 마커들 -->
  <circle cx="180" cy="408" r="8" fill="white"/>
  <circle cx="280" cy="408" r="8" fill="white"/>
</svg>
`;

async function generateIcons() {
  const buildDir = path.join(__dirname, '../build');

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  console.log('🎨 Weaver Pro 아이콘 생성 중...');

  // SVG를 버퍼로 변환
  const svgBuffer = Buffer.from(iconSVG);

  // 1. Linux용 512x512 PNG
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(buildDir, 'icon.png'));
  console.log('✅ Linux icon.png (512x512) 생성 완료');

  // 2. Windows용 ICO (256x256 PNG로 생성 - electron-builder가 자동 변환)
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(path.join(buildDir, 'icon.ico.png'));
  console.log('✅ Windows icon.ico용 PNG (256x256) 생성 완료');

  // 3. Mac용 ICNS (1024x1024 PNG로 생성 - electron-builder가 자동 변환)
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(buildDir, 'icon.icns.png'));
  console.log('✅ Mac icon.icns용 PNG (1024x1024) 생성 완료');

  // 4. 추가 크기들 (Windows ICO 내부용)
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(buildDir, `icon_${size}x${size}.png`));
  }
  console.log('✅ 다양한 크기 아이콘 생성 완료');

  console.log('\n🎉 모든 아이콘 생성 완료!');
  console.log('📁 위치: build/ 디렉토리');
  console.log('\n⚠️  참고: electron-builder는 PNG를 자동으로 ICO/ICNS로 변환합니다.');
  console.log('   - Windows: icon.ico.png → icon.ico');
  console.log('   - Mac: icon.icns.png → icon.icns');
}

generateIcons().catch(console.error);
