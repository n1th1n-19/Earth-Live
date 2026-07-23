// Must be imported (for its side effect) before any `cesium`/`resium` import,
// so Cesium's runtime finds its Workers/Assets/ThirdParty/Widgets under the
// static path scripts/copy-cesium-assets.mjs populates — see
// docs/05-api-integration-guide.md §5.9 and docs/07-tech-stack.md §7.1.
declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

if (typeof window !== "undefined") {
  window.CESIUM_BASE_URL = "/cesium/";
}

export {};
