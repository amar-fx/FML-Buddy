import { company, displayName, version } from "../../../shared/shared";
import { keyRegisterOverride, dropDisable } from "./cep";

export const handleRefresh = () => {
  try {
    window.location.reload();
  } catch (e) {
    window.location.href = window.location.href;
  }
};

export const handleForceRefresh = () => {
  try {
    // If in CEP environment, attempt to re-evaluate ExtendScript
    if (typeof window !== "undefined" && window.cep) {
      try {
        const { csi, evalFile } = require("./bolt");
        const { fs } = require("../cep/node");
        const extRoot = csi.getSystemPath("extension");
        const jsxSrc = `${extRoot}/jsx/index.js`;
        if (fs && fs.existsSync && fs.existsSync(jsxSrc)) {
          evalFile(jsxSrc);
          console.log("[FML Buddy] ExtendScript reloaded from:", jsxSrc);
        }
      } catch (err) {
        console.warn("[FML Buddy] Could not reload ExtendScript file:", err);
      }
    }

    // Force browser / CEF cache-busting reload
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("_force_refresh", Date.now().toString());
    window.location.href = currentUrl.toString();
  } catch (e) {
    window.location.reload();
  }
};

const buildFlyoutMenu = () => {
  if (typeof window === "undefined" || !window.__adobe_cep__) return;
  const menu = `<Menu>
  <MenuItem Id="info" Label="FML Buddy v${version}" Enabled="false" Checked="false"/>
  <MenuItem Id="website" Label="by Amarshafan M" Enabled="false" Checked="false"/>
  <MenuItem Label="---" />
  <MenuItem Id="refresh" Label="Refresh" Enabled="true" Checked="false"/>
  <MenuItem Id="force-refresh" Label="Force Refresh" Enabled="true" Checked="false"/>
  </Menu>`;

  interface FlyoutMenuEvent {
    data:
      | {
          menuId: string;
        }
      | string;
  }
  const flyoutHandler = (event: FlyoutMenuEvent) => {
    let menuId: string | undefined;
    if (typeof event.data === "string") {
      try {
        menuId = JSON.parse(
          event.data.replace(/\$/g, "").replace(/\=2/g, ":")
        ).menuId;
      } catch (e) {
        console.error(e);
      }
    } else if (event.data && typeof event.data === "object") {
      menuId = event.data.menuId;
    }

    if (menuId === "refresh") {
      handleRefresh();
    } else if (menuId === "force-refresh") {
      handleForceRefresh();
    }
  };

  try {
    window.__adobe_cep__.invokeSync("setPanelFlyoutMenu", menu);
    window.__adobe_cep__.addEventListener(
      "com.adobe.csxs.events.flyoutMenuClicked",
      flyoutHandler
    );
  } catch (err) {
    console.warn("[FML Buddy] Could not register panel flyout menu:", err);
  }
};

const buildContextMenu = () => {
  if (typeof window === "undefined" || !window.__adobe_cep__) return;
  const menuObj = {
    menu: [
      {
        label: "Refresh",
        enabled: true,
        checked: false,
        checkable: false,
        id: "c-refresh",
      },
      {
        label: "Force Refresh",
        enabled: true,
        checked: false,
        checkable: false,
        id: "c-force-refresh",
      },
    ],
  };

  try {
    window.__adobe_cep__.invokeAsync(
      "setContextMenuByJSON",
      JSON.stringify(menuObj),
      (menuId: string) => {
        if (menuId === "c-refresh") {
          handleRefresh();
        } else if (menuId === "c-force-refresh") {
          handleForceRefresh();
        }
      }
    );
  } catch (err) {
    console.warn("[FML Buddy] Could not register native context menu:", err);
  }
};

export const registerHostKeyEvents = () => {
  keyRegisterOverride();
};

export const initializeCEP = () => {
  buildFlyoutMenu();
  buildContextMenu();
  keyRegisterOverride();
  dropDisable(); // to prevent drop files on panel and taking over
};
