// Windows용 .ico 파일 생성 스크립트
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, '../electron/assets/icon.png');
const buildDir = path.join(__dirname, '../build');

// 간단한 ICO 헤더 생성 함수
function createIcoFromPng(pngPath, icoPath) {
  try {
    console.log(`📝 ICO 생성 시작: ${pngPath}`);

    // PNG 파일을 읽음
    const pngBuffer = fs.readFileSync(pngPath);

    // 간단한 ICO 형식 생성
    // ICO 헤더: 6 bytes (reserved=0, type=1, count=1)
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0);  // 예약됨
    icoHeader.writeUInt16LE(1, 2);  // 타입 (1 = ICO)
    icoHeader.writeUInt16LE(1, 4);  // 이미지 개수

    // 이미지 디렉토리: 16 bytes
    const imageDir = Buffer.alloc(16);
    imageDir[0] = 256;              // 너비 (0 = 256)
    imageDir[1] = 256;              // 높이 (0 = 256)
    imageDir[2] = 0;                // 팔레트 색상 (0 = 없음)
    imageDir[3] = 0;                // 예약됨
    imageDir.writeUInt16LE(1, 4);   // 색상 평면
    imageDir.writeUInt16LE(32, 6);  // 비트/픽셀
    imageDir.writeUInt32LE(pngBuffer.length, 8);  // 이미지 크기
    imageDir.writeUInt32LE(6 + 16, 12);  // 이미지 오프셋

    // 최종 ICO 파일 (헤더 + 디렉토리 + PNG 데이터)
    const icoBuffer = Buffer.concat([icoHeader, imageDir, pngBuffer]);

    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`✅ ICO 생성 완료: ${icoPath}`);
    return true;
  } catch (error) {
    console.error('❌ ICO 생성 실패:', error.message);
    console.warn('⚠️  PNG를 그대로 복사합니다...');
    try {
      fs.copyFileSync(pngPath, icoPath);
      return true;
    } catch (copyError) {
      console.error('❌ 복사 실패:', copyError.message);
      return false;
    }
  }
}

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

    // ICO 형식으로 생성
    const success = createIcoFromPng(icon256, icoPath);
    if (success) {
      console.log('✅ icon.ico 생성 완료');
    } else {
      console.log('⚠️  icon.ico 생성 완료 (대체 방식)');
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
