// electron/services/store.js
const Store = require("electron-store");
const store = new Store({ name: "settings" });

// 실제 파일 저장 경로 로그 출력
console.log("📁 electron-store 설정 파일 경로:", store.path);

module.exports = store;
