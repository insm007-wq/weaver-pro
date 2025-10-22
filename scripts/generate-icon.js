// Windows용 .ico 파일 생성 스크립트
const sharp = require('sharp');
const { imagesToIco } = require('png-to-ico');
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

    // 다양한 크기의 PNG 생성
    const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

    for (const size of sizes) {
      await sharp(iconPath)
        .resize(size, size)
        .png()
        .toFile(path.join(buildDir, `icon_${size}x${size}.png`));
      console.log(`✅ icon_${size}x${size}.png 생성 완료`);
    }

    // Windows용 icon.ico (PNG를 ICO 형식으로 변환)
    const icon256 = path.join(buildDir, 'icon_256x256.png');
    const icoPath = path.join(buildDir, 'icon.ico');

    try {
      // imagesToIco는 이미지 버퍼의 배열을 기대함
      const imageBuffer = fs.readFileSync(icon256);
      const buf = await imagesToIco([imageBuffer]);
      fs.writeFileSync(icoPath, buf);
      console.log('✅ icon.ico 생성 완료 (png-to-ico 변환)');
    } catch (icoError) {
      console.warn('⚠️  ICO 변환 실패:', icoError.message);
      // 폴백: 256x256 PNG를 ico로 복사 (비권장하지만 작동할 수 있음)
      fs.copyFileSync(icon256, icoPath);
      console.log('⚠️  폴백: PNG 파일을 ico 확장자로 복사');
    }

    // macOS용 icon.icns (512x512 PNG 복사)
    const icon512 = path.join(buildDir, 'icon_512x512.png');
    const icnsPath = path.join(buildDir, 'icon.icns');
    fs.copyFileSync(icon512, icnsPath);
    console.log('✅ icon.icns 생성 완료');

    console.log('');
    console.log('🎉 모든 아이콘 생성 완료!');
    console.log('');
    console.log('📁 생성된 파일들:');
    console.log('  - build/icon.png (512x512)');
    console.log('  - build/icon_*.png (16~512 다양한 크기)');
    console.log('  - build/icon.ico (Windows용 - png-to-ico 변환)');
    console.log('  - build/icon.icns (macOS용)');

  } catch (error) {
    console.error('❌ 아이콘 생성 실패:', error);
    process.exit(1);
  }
}

generateIcons();
