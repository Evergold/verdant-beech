// test_i18n.js (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>
// Licensed under the MIT License (see LICENSE for details)

const i18next = require('i18next');
async function run() {
  await i18next.init({ lng: 'en', resources: { en: { translation: { key: 'val' } } } });
  console.log("Init 1 success");
  try {
    await i18next.init({ lng: 'en', resources: { en: { translation: { key: 'val' } } } });
    console.log("Init 2 success");
  } catch(e) {
    console.error("Init 2 failed", e);
  }
}
run();
