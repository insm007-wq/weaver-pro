// electron/services/store.js
const Store = require("electron-store");
const store = new Store({ name: "settings" });
module.exports = store;
