// electron/services/replicateClient.js
const axios = require("axios");
const Replicate = require("replicate");

async function resolveLatestVersionId(slug, token) {
  const [owner, name] = (slug || "").split("/");
  if (!owner || !name) throw new Error(`Invalid model slug: ${slug}`);
  const headers = { Authorization: `Token ${token}` };

  try {
    const r = await axios.get(
      `https://api.replicate.com/v1/models/${owner}/${name}/versions?limit=1`,
      { headers, timeout: 15000 }
    );
    const id = r?.data?.results?.[0]?.id;
    if (id) return id;
  } catch (_) {}

  try {
    const r = await axios.get(
      `https://api.replicate.com/v1/models/${owner}/${name}`,
      { headers, timeout: 15000 }
    );
    return r?.data?.latest_version?.id || null;
  } catch (_) {}

  return null;
}

function createReplicate(token) {
  return new Replicate({ auth: token });
}

module.exports = { resolveLatestVersionId, createReplicate };
