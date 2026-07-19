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
