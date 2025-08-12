// electron/services/secrets.js
const keytar = require("keytar");
const SERVICE = "ContentWeaverPro";

const getSecret = (key) => keytar.getPassword(SERVICE, key);
const setSecret = (key, value) => keytar.setPassword(SERVICE, key, value || "");

module.exports = { SERVICE, getSecret, setSecret };
