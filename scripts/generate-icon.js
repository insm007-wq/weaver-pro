// Windows용 .ico 파일 생성 스크립트
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, '../electron/assets/icon.png');
const buildDir = path.join(__dirname, '../build');

// build 디렉토리가 없으면 생성
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

async function generateIcons() {
  console.log('🎨 아이콘 생성 시작...');

  try {
    // 원본 PNG 복사
    const outputPng = path.join(buildDir, 'icon.png');
    fs.copyFileSync(iconPath, outputPng);
    console.log('✅ icon.png 복사 완료');

    // 다양한 크기의 PNG 생성 (Windows용)
    const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

    for (const size of sizes) {
      await sharp(iconPath)
        .resize(size, size)
        .png()
        .toFile(path.join(buildDir, `icon_${size}x${size}.png`));
      console.log(`✅ icon_${size}x${size}.png 생성 완료`);
    }

    // 256x256 아이콘을 .ico로 변환 (electron-builder가 사용)
    await sharp(iconPath)
      .resize(256, 256)
      .png()
      .toFile(path.join(buildDir, 'icon.ico.png'));
    console.log('✅ icon.ico.png 생성 완료');

    // macOS용 .icns 대신 PNG 생성
    await sharp(iconPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(buildDir, 'icon.icns.png'));
    console.log('✅ icon.icns.png 생성 완료');

    console.log('');
    console.log('🎉 모든 아이콘 생성 완료!');
    console.log('');
    console.log('📁 생성된 파일들:');
    console.log('  - build/icon.png (512x512)');
    console.log('  - build/icon_*.png (16~512 다양한 크기)');
    console.log('  - build/icon.ico.png (Windows용)');
    console.log('  - build/icon.icns.png (macOS용)');

  } catch (error) {
    console.error('❌ 아이콘 생성 실패:', error);
    process.exit(1);
  }
}

generateIcons();
