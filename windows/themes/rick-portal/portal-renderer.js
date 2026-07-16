((cssText, homeArtDataUrl, homeHeroArtDataUrl, workArtDataUrl, themeMeta) => {
  const STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const STYLE_ID = "codex-dream-skin-style";
  const CHROME_ID = "codex-dream-skin-chrome";
  const ROOT_CLASSES = ["codex-dream-skin", "portal-skin"];
  const SHELL_CLASSES = ["dream-home-shell", "portal-home-shell", "portal-thread-shell", "portal-secondary-shell"];
  window.__CODEX_DREAM_SKIN_DISABLED__ = false;

  const previous = window[STATE_KEY];
  previous?.observer?.disconnect();
  if (previous?.timer) clearInterval(previous.timer);
  if (previous?.scheduler?.timeout) clearTimeout(previous.scheduler.timeout);
  if (previous?.onResize) {
    window.removeEventListener("resize", previous.onResize);
    window.visualViewport?.removeEventListener("resize", previous.onResize);
  }

  const toObjectUrl = (dataUrl) => {
    const comma = dataUrl.indexOf(",");
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  };

  const canReuseAssets = previous?.theme === themeMeta.id && previous?.version === themeMeta.version;
  const homeArtUrl = canReuseAssets && previous?.homeArtUrl
    ? previous.homeArtUrl
    : toObjectUrl(homeArtDataUrl);
  const homeHeroArtUrl = canReuseAssets && previous?.homeHeroArtUrl
    ? previous.homeHeroArtUrl
    : toObjectUrl(homeHeroArtDataUrl);
  const workArtUrl = canReuseAssets && previous?.workArtUrl
    ? previous.workArtUrl
    : toObjectUrl(workArtDataUrl);
  if (!canReuseAssets) {
    if (previous?.homeArtUrl) URL.revokeObjectURL(previous.homeArtUrl);
    if (previous?.homeHeroArtUrl) URL.revokeObjectURL(previous.homeHeroArtUrl);
    if (previous?.workArtUrl) URL.revokeObjectURL(previous.workArtUrl);
  }

  const classifyPage = () => {
    const home = document.querySelector('[role="main"]:has([data-testid="home-icon"])');
    if (home) return { mode: "home", main: home };
    const main = document.querySelector('[role="main"]');
    const hasConversation = Boolean(document.querySelector(
      '[data-message-author-role], article, .composer-surface-chrome, .thread-scroll-container'
    ));
    return { mode: hasConversation ? "thread" : "secondary", main };
  };

  const clearShellClasses = (node) => {
    if (node) node.classList.remove(...SHELL_CLASSES);
  };

  const ensure = () => {
    if (window.__CODEX_DREAM_SKIN_DISABLED__) return;
    const root = document.documentElement;
    const body = document.body;
    const shellMain = document.querySelector("main.main-surface") || document.querySelector("main");
    if (!root || !body || !shellMain) return;

    root.classList.add(...ROOT_CLASSES);
    root.style.setProperty("--portal-home-art", `url("${homeArtUrl}")`);
    root.style.setProperty("--portal-home-hero-art", `url("${homeHeroArtUrl}")`);
    root.style.setProperty("--portal-work-art", `url("${workArtUrl}")`);
    root.dataset.portalTheme = themeMeta.id;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    if (style.dataset.dreamVersion !== themeMeta.version || style.dataset.dreamTheme !== themeMeta.id) {
      style.textContent = cssText;
      style.dataset.dreamVersion = themeMeta.version;
      style.dataset.dreamTheme = themeMeta.id;
    }

    const { mode, main } = classifyPage();
    for (const candidate of document.querySelectorAll(".dream-home, .portal-home")) {
      if (candidate !== main) candidate.classList.remove("dream-home", "portal-home");
    }
    if (mode === "home" && main) main.classList.add("dream-home", "portal-home");
    document.querySelectorAll(".portal-dimension-suffix").forEach((node) => {
      if (mode !== "home" || !main?.contains(node)) node.remove();
    });
    if (mode === "home") {
      const source = main?.querySelector('[data-feature="game-source"]');
      const projectButton = source?.querySelector("button");
      if (projectButton && !source.querySelector(".portal-dimension-suffix")) {
        const suffix = document.createElement("span");
        suffix.className = "portal-dimension-suffix";
        suffix.textContent = "维度";
        projectButton.insertAdjacentElement("afterend", suffix);
      }
    }

    clearShellClasses(shellMain);
    shellMain.classList.add(`portal-${mode}-shell`);
    if (mode === "home") shellMain.classList.add("dream-home-shell");
    root.dataset.portalMode = mode;

    let chrome = document.getElementById(CHROME_ID);
    if (!chrome || chrome.parentElement !== body || chrome.dataset.dreamTheme !== themeMeta.id) {
      chrome?.remove();
      chrome = document.createElement("div");
      chrome.id = CHROME_ID;
      chrome.dataset.dreamTheme = themeMeta.id;
      chrome.setAttribute("aria-hidden", "true");
      chrome.innerHTML = `
        <div class="portal-brand"><span class="portal-mark"></span><span><b>多元宇宙开发站</b><small>CODEX PORTAL EDITION</small></span></div>
        <div class="portal-status"><i></i>PORTAL ONLINE</div>
        <div class="portal-stars"><i></i><i></i><i></i><i></i><i></i></div>`;
      body.appendChild(chrome);
    }
    clearShellClasses(chrome);
    chrome.classList.add(`portal-${mode}-shell`);
    if (mode === "home") chrome.classList.add("dream-home-shell");

    const shellBox = shellMain.getBoundingClientRect();
    chrome.style.left = `${Math.round(shellBox.left)}px`;
    chrome.style.top = `${Math.round(shellBox.top)}px`;
    chrome.style.width = `${Math.round(shellBox.width)}px`;
    chrome.style.height = `${Math.round(shellBox.height)}px`;
  };

  const cleanup = () => {
    window.__CODEX_DREAM_SKIN_DISABLED__ = true;
    const root = document.documentElement;
    root?.classList.remove(...ROOT_CLASSES);
    root?.style.removeProperty("--portal-home-art");
    root?.style.removeProperty("--portal-home-hero-art");
    root?.style.removeProperty("--portal-work-art");
    if (root?.dataset) {
      delete root.dataset.portalTheme;
      delete root.dataset.portalMode;
    }
    document.querySelectorAll(".dream-home, .portal-home").forEach((node) => node.classList.remove("dream-home", "portal-home"));
    document.querySelectorAll(".portal-dimension-suffix").forEach((node) => node.remove());
    document.querySelectorAll(SHELL_CLASSES.map((name) => `.${name}`).join(",")).forEach(clearShellClasses);
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CHROME_ID)?.remove();
    const state = window[STATE_KEY];
    state?.observer?.disconnect();
    if (state?.timer) clearInterval(state.timer);
    if (state?.scheduler?.timeout) clearTimeout(state.scheduler.timeout);
    if (state?.onResize) {
      window.removeEventListener("resize", state.onResize);
      window.visualViewport?.removeEventListener("resize", state.onResize);
    }
    if (state?.homeArtUrl) URL.revokeObjectURL(state.homeArtUrl);
    if (state?.homeHeroArtUrl) URL.revokeObjectURL(state.homeHeroArtUrl);
    if (state?.workArtUrl) URL.revokeObjectURL(state.workArtUrl);
    delete window[STATE_KEY];
    return true;
  };

  const scheduler = { timeout: null };
  const scheduleEnsure = () => {
    if (scheduler.timeout) clearTimeout(scheduler.timeout);
    scheduler.timeout = setTimeout(() => {
      scheduler.timeout = null;
      ensure();
    }, 180);
  };
  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const onResize = () => scheduleEnsure();
  window.addEventListener("resize", onResize, { passive: true });
  window.visualViewport?.addEventListener("resize", onResize, { passive: true });
  const timer = setInterval(ensure, 5000);
  window[STATE_KEY] = {
    ensure,
    cleanup,
    observer,
    timer,
    scheduler,
    onResize,
    homeArtUrl,
    homeHeroArtUrl,
    workArtUrl,
    version: themeMeta.version,
    theme: themeMeta.id,
  };
  ensure();
  return { installed: true, version: themeMeta.version, theme: themeMeta.id };
})(__PORTAL_CSS_JSON__, __PORTAL_HOME_ART_JSON__, __PORTAL_HOME_HERO_ART_JSON__, __PORTAL_WORK_ART_JSON__, __PORTAL_THEME_META_JSON__)
