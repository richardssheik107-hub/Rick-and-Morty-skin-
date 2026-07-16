((cssText, homeArtDataUrl, homeHeroArtDataUrl, workArtDataUrl, workForegroundDataUrl, portalTextureDataUrl, themeMeta) => {
  const STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const STYLE_ID = "codex-dream-skin-style";
  const CHROME_ID = "codex-dream-skin-chrome";
  const FLUID_CANVAS_ID = "codex-portal-fluid";
  const MOTION_CANVAS_ID = "codex-portal-motion";
  const ROOT_CLASSES = ["codex-dream-skin", "portal-skin"];
  const SHELL_CLASSES = ["dream-home-shell", "portal-home-shell", "portal-thread-shell", "portal-secondary-shell"];
  window.__CODEX_DREAM_SKIN_DISABLED__ = false;

  const previous = window[STATE_KEY];
  previous?.motion?.destroy?.();
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
  const workForegroundUrl = canReuseAssets && previous?.workForegroundUrl
    ? previous.workForegroundUrl
    : toObjectUrl(workForegroundDataUrl);
  const portalTextureUrl = canReuseAssets && previous?.portalTextureUrl
    ? previous.portalTextureUrl
    : toObjectUrl(portalTextureDataUrl);
  if (!canReuseAssets) {
    if (previous?.homeArtUrl) URL.revokeObjectURL(previous.homeArtUrl);
    if (previous?.homeHeroArtUrl) URL.revokeObjectURL(previous.homeHeroArtUrl);
    if (previous?.workArtUrl) URL.revokeObjectURL(previous.workArtUrl);
    if (previous?.workForegroundUrl) URL.revokeObjectURL(previous.workForegroundUrl);
    if (previous?.portalTextureUrl) URL.revokeObjectURL(previous.portalTextureUrl);
  }

  const createPortalMotion = (rawConfig = {}, textureUrl) => {
    const portalConfig = rawConfig.portal || {};
    const config = {
      enabled: rawConfig.enabled !== false,
      targetFps: Math.max(20, Math.min(60, Number(rawConfig.targetFps) || 30)),
      minimumFps: Math.max(18, Math.min(40, Number(rawConfig.minimumFps) || 26)),
      maximumDevicePixelRatio: Math.max(1, Math.min(2, Number(rawConfig.maximumDevicePixelRatio) || 1.5)),
      fluidResolutionScale: Math.max(0.45, Math.min(1, Number(rawConfig.fluidResolutionScale) || 0.72)),
      portal: {
        fit: portalConfig.fit === "contain" ? "contain" : "cover",
        sourceWidth: Number(portalConfig.sourceWidth) || 1672,
        sourceHeight: Number(portalConfig.sourceHeight) || 941,
        centerX: Number(portalConfig.centerX) || 0.795,
        centerY: Number(portalConfig.centerY) || 0.49,
        radiusX: Number(portalConfig.radiusX) || 0.235,
        radiusY: Number(portalConfig.radiusY) || 0.43,
      },
    };

    let canvas = null;
    let context = null;
    let fluidCanvas = null;
    let gl = null;
    let fluidProgram = null;
    let fluidUniforms = null;
    let fluidTexture = null;
    let fluidTextureReady = false;
    let fluidTextureImage = null;
    let fluidAvailable = false;
    let fluidFailure = null;
    let host = null;
    let resizeObserver = null;
    let frameRequest = 0;
    let active = false;
    let destroyed = false;
    let lastDrawTime = 0;
    let currentFps = config.targetFps;
    let rollingDrawMs = 0;
    let slowFrames = 0;
    let fastFrames = 0;
    let frameCount = 0;
    let portalGeometry = null;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;

    const vertexShaderSource = `#version 300 es
      precision highp float;
      const vec2 positions[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
      void main() { gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0); }
    `;
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      uniform vec2 uResolution;
      uniform vec2 uCenter;
      uniform vec2 uRadius;
      uniform float uTime;
      uniform sampler2D uPortalTexture;
      out vec4 outColor;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                   mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);
        for (int octave = 0; octave < 4; octave++) {
          value += amplitude * noise(p);
          p = turn * p * 2.03 + 11.7;
          amplitude *= 0.49;
        }
        return value;
      }
      vec2 portalUv(float radius, float angle, float time, float phase) {
        float radialNoise = fbm(vec2(angle * 1.18 + phase, radius * 6.4 - time * 0.10));
        float differentialSpin = time * (0.012 + (1.0 - min(radius, 1.0)) * 0.022);
        float liquidShear = sin(radius * 13.5 - time * 0.22 + phase) * 0.008;
        liquidShear += (radialNoise - 0.5) * 0.018;
        float flowedAngle = angle - differentialSpin + liquidShear;
        float flowedRadius = radius;
        flowedRadius += sin(angle * 5.0 + time * 0.27 + phase) * 0.0035;
        flowedRadius += sin(radius * 19.0 - time * 0.31 + radialNoise * 3.0) * 0.0045;
        vec2 direction = vec2(cos(flowedAngle), sin(flowedAngle));
        return vec2(0.5) + direction * flowedRadius * 0.40;
      }
      void main() {
        vec2 p = (gl_FragCoord.xy - uCenter) / max(uRadius * 0.84, vec2(1.0));
        float radius = length(p);
        float angle = atan(p.y, p.x);
        float time = uTime * 0.001;
        vec2 baseUv = vec2(0.5) + p * 0.40;
        vec2 flowUv = portalUv(radius, angle, time, 0.0);
        vec3 textureBase = texture(uPortalTexture, baseUv, 0.25).rgb;
        vec3 textureFlow = texture(uPortalTexture, flowUv, 0.35).rgb;
        float flowMix = 0.22 + 0.08 * fbm(vec2(angle * 1.6, radius * 8.0 - time * 0.10));
        vec3 color = mix(textureBase, textureFlow, flowMix);

        float greenSignal = textureBase.g - max(textureBase.r, textureBase.b) * 0.18;
        float liquidMask = smoothstep(0.035, 0.15, greenSignal);
        float edgeNoise = fbm(vec2(angle * 2.2 - time * 0.08, radius * 7.0));
        float boundary = 1.015 + (edgeNoise - 0.5) * 0.022;
        float circleMask = 1.0 - smoothstep(boundary - 0.045, boundary, radius);
        float core = pow(max(0.0, 1.0 - radius), 4.1);
        float pulse = 0.96 + 0.04 * sin(time * 0.82);

        color *= vec3(1.0, 1.025, 1.0);
        color += vec3(0.48, 0.82, 0.12) * core * 0.08;
        float innerDisc = 1.0 - smoothstep(0.76, 0.94, radius);
        float alpha = circleMask * max(innerDisc * 0.72, liquidMask * 0.90) * pulse;
        outColor = vec4(color, clamp(alpha, 0.0, 0.92));
      }
    `;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "Unknown shader compile failure";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };

    const uploadFluidTexture = () => {
      if (!gl || !fluidTextureImage?.complete || !fluidTextureImage.naturalWidth) return false;
      if (fluidTexture) gl.deleteTexture(fluidTexture);
      fluidTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, fluidTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fluidTextureImage);
      gl.generateMipmap(gl.TEXTURE_2D);
      fluidTextureReady = true;
      fluidCanvas.dataset.portalTexture = `${fluidTextureImage.naturalWidth}x${fluidTextureImage.naturalHeight}`;
      if (active && !reducedMotion?.matches) {
        fluidCanvas.hidden = false;
        queueMicrotask(() => {
          if (active && !destroyed) renderScene(performance.now());
        });
      }
      return true;
    };

    const initializeFluid = () => {
      fluidAvailable = false;
      fluidTextureReady = false;
      fluidFailure = null;
      if (!fluidCanvas) return;
      try {
        gl = fluidCanvas.getContext("webgl2", {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "low-power",
        });
        if (!gl) throw new Error("WebGL2 unavailable");
        const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        fluidProgram = gl.createProgram();
        gl.attachShader(fluidProgram, vertexShader);
        gl.attachShader(fluidProgram, fragmentShader);
        gl.linkProgram(fluidProgram);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (!gl.getProgramParameter(fluidProgram, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(fluidProgram));
        fluidUniforms = {
          resolution: gl.getUniformLocation(fluidProgram, "uResolution"),
          center: gl.getUniformLocation(fluidProgram, "uCenter"),
          radius: gl.getUniformLocation(fluidProgram, "uRadius"),
          time: gl.getUniformLocation(fluidProgram, "uTime"),
          portalTexture: gl.getUniformLocation(fluidProgram, "uPortalTexture"),
        };
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        fluidAvailable = true;
        fluidCanvas.dataset.portalMotion = "webgl2-fluid";
        if (!fluidTextureImage) {
          fluidTextureImage = new Image();
          fluidTextureImage.decoding = "async";
          fluidTextureImage.onload = uploadFluidTexture;
          fluidTextureImage.onerror = () => {
            fluidTextureReady = false;
            fluidFailure = "Portal texture failed to load";
          };
          fluidTextureImage.src = textureUrl;
        } else {
          uploadFluidTexture();
        }
      } catch (error) {
        fluidFailure = String(error?.message || error);
        fluidCanvas.dataset.portalMotion = "canvas-fallback";
        gl = null;
        fluidProgram = null;
        fluidTexture = null;
      }
    };

    const parsePosition = (token, axis) => {
      const normalized = String(token || "").trim().toLowerCase();
      if (normalized === "left" || normalized === "top") return 0;
      if (normalized === "right" || normalized === "bottom") return 1;
      if (normalized === "center") return 0.5;
      if (normalized.endsWith("%")) return Math.max(0, Math.min(1, Number.parseFloat(normalized) / 100));
      return axis === "x" ? 1 : 0.5;
    };

    const calculatePortalGeometry = () => {
      if (!host) return null;
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return null;
      const style = getComputedStyle(host);
      const positions = style.backgroundPosition.split(",");
      const workPosition = (positions.at(-1) || "100% 50%").trim().split(/\s+/);
      const positionX = parsePosition(workPosition[0], "x");
      const positionY = parsePosition(workPosition[1] || "50%", "y");
      const sourceWidth = config.portal.sourceWidth;
      const sourceHeight = config.portal.sourceHeight;
      const scale = config.portal.fit === "contain"
        ? Math.min(width / sourceWidth, height / sourceHeight)
        : Math.max(width / sourceWidth, height / sourceHeight);
      const renderedWidth = sourceWidth * scale;
      const renderedHeight = sourceHeight * scale;
      const offsetX = (width - renderedWidth) * positionX;
      const offsetY = (height - renderedHeight) * positionY;
      return {
        centerX: offsetX + renderedWidth * config.portal.centerX,
        centerY: offsetY + renderedHeight * config.portal.centerY,
        radiusX: renderedWidth * config.portal.radiusX,
        radiusY: renderedHeight * config.portal.radiusY,
        width,
        height,
        scale,
        positionX,
        positionY,
      };
    };

    const resize = () => {
      if (!canvas || !host) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const ratio = Math.min(config.maximumDevicePixelRatio, window.devicePixelRatio || 1);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context = canvas.getContext("2d", { alpha: true, desynchronized: true });
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      if (fluidCanvas) {
        const fluidRatio = ratio * config.fluidResolutionScale;
        const fluidWidth = Math.max(1, Math.round(width * fluidRatio));
        const fluidHeight = Math.max(1, Math.round(height * fluidRatio));
        if (fluidCanvas.width !== fluidWidth || fluidCanvas.height !== fluidHeight) {
          fluidCanvas.width = fluidWidth;
          fluidCanvas.height = fluidHeight;
          fluidCanvas.style.width = `${width}px`;
          fluidCanvas.style.height = `${height}px`;
          gl?.viewport(0, 0, fluidWidth, fluidHeight);
        }
      }
      portalGeometry = calculatePortalGeometry();
      if (portalGeometry) {
        const clip = `ellipse(${Math.round(portalGeometry.radiusX * 1.13)}px ${Math.round(portalGeometry.radiusY * 1.11)}px at ${Math.round(portalGeometry.centerX)}px ${Math.round(portalGeometry.centerY)}px)`;
        canvas.style.clipPath = clip;
        if (fluidCanvas) fluidCanvas.style.clipPath = clip;
      }
    };

    const ensureCanvas = (nextHost) => {
      if (!nextHost) return;
      if (host !== nextHost || !canvas?.isConnected) {
        resizeObserver?.disconnect();
        canvas?.remove();
        fluidCanvas?.remove();
        host = nextHost;
        fluidCanvas = document.createElement("canvas");
        fluidCanvas.id = FLUID_CANVAS_ID;
        fluidCanvas.setAttribute("aria-hidden", "true");
        canvas = document.createElement("canvas");
        canvas.id = MOTION_CANVAS_ID;
        canvas.setAttribute("aria-hidden", "true");
        canvas.dataset.portalMotion = "canvas-2d";
        host.insertBefore(fluidCanvas, host.firstChild);
        host.insertBefore(canvas, host.firstChild);
        initializeFluid();
        fluidCanvas.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          fluidAvailable = false;
          fluidFailure = "WebGL context lost";
        });
        fluidCanvas.addEventListener("webglcontextrestored", initializeFluid);
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
      }
      canvas.hidden = false;
      fluidCanvas.hidden = !(fluidAvailable && fluidTextureReady);
      resize();
    };

    const drawFluid = (time) => {
      if (!fluidAvailable || !fluidTextureReady || !gl || !fluidProgram || !fluidTexture || !portalGeometry || !fluidCanvas) return false;
      const scaleX = fluidCanvas.width / Math.max(1, portalGeometry.width);
      const scaleY = fluidCanvas.height / Math.max(1, portalGeometry.height);
      gl.viewport(0, 0, fluidCanvas.width, fluidCanvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const scissorX = Math.max(0, Math.floor((portalGeometry.centerX - portalGeometry.radiusX * 1.14) * scaleX));
      const scissorY = Math.max(0, Math.floor(fluidCanvas.height - (portalGeometry.centerY + portalGeometry.radiusY * 1.14) * scaleY));
      const scissorWidth = Math.min(fluidCanvas.width - scissorX, Math.ceil(portalGeometry.radiusX * 2.28 * scaleX));
      const scissorHeight = Math.min(fluidCanvas.height - scissorY, Math.ceil(portalGeometry.radiusY * 2.28 * scaleY));
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(scissorX, scissorY, Math.max(1, scissorWidth), Math.max(1, scissorHeight));
      gl.useProgram(fluidProgram);
      gl.uniform2f(fluidUniforms.resolution, fluidCanvas.width, fluidCanvas.height);
      gl.uniform2f(
        fluidUniforms.center,
        portalGeometry.centerX * scaleX,
        fluidCanvas.height - portalGeometry.centerY * scaleY,
      );
      gl.uniform2f(fluidUniforms.radius, portalGeometry.radiusX * scaleX, portalGeometry.radiusY * scaleY);
      gl.uniform1f(fluidUniforms.time, time);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fluidTexture);
      gl.uniform1i(fluidUniforms.portalTexture, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
      return true;
    };

    const drawFallbackGlow = (time) => {
      const geometry = portalGeometry;
      if (!geometry) return;
      const pulse = 0.92 + Math.sin(time * 0.00125) * 0.08;
      context.save();
      context.translate(geometry.centerX, geometry.centerY);
      context.scale(1, geometry.radiusY / geometry.radiusX);
      const glow = context.createRadialGradient(0, 0, 0, 0, 0, geometry.radiusX);
      glow.addColorStop(0, `rgba(244,255,204,${0.26 * pulse})`);
      glow.addColorStop(0.28, `rgba(163,255,54,${0.16 * pulse})`);
      glow.addColorStop(0.72, `rgba(53,210,71,${0.07 * pulse})`);
      glow.addColorStop(1, "rgba(20,140,78,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(0, 0, geometry.radiusX, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const adaptPerformance = (drawMilliseconds) => {
      rollingDrawMs = rollingDrawMs ? rollingDrawMs * 0.92 + drawMilliseconds * 0.08 : drawMilliseconds;
      if (rollingDrawMs > 8.5) {
        slowFrames += 1;
        fastFrames = 0;
      } else if (rollingDrawMs < 3.8) {
        fastFrames += 1;
        slowFrames = Math.max(0, slowFrames - 1);
      } else {
        slowFrames = Math.max(0, slowFrames - 1);
        fastFrames = 0;
      }
      if (slowFrames >= 18) {
        currentFps = config.minimumFps;
        slowFrames = 0;
      } else if (fastFrames >= 260) {
        currentFps = config.targetFps;
        fastFrames = 0;
      }
    };

    const shouldAnimate = () => config.enabled && active && !destroyed && !document.hidden && !reducedMotion?.matches;
    const renderScene = (time) => {
      if (!context || !portalGeometry) resize();
      if (!context || !portalGeometry) return false;
      const drawStarted = performance.now();
      context.clearRect(0, 0, portalGeometry.width, portalGeometry.height);
      if (!drawFluid(time)) drawFallbackGlow(time);
      frameCount += 1;
      adaptPerformance(performance.now() - drawStarted);
      return true;
    };

    const drawFrame = (time) => {
      frameRequest = 0;
      if (!shouldAnimate()) return;
      frameRequest = requestAnimationFrame(drawFrame);
      const interval = 1000 / currentFps;
      if (time - lastDrawTime < interval) return;
      lastDrawTime = time;
      renderScene(time);
    };

    const updateLoop = () => {
      if (shouldAnimate()) {
        canvas?.removeAttribute("hidden");
        if (fluidAvailable && fluidTextureReady) fluidCanvas?.removeAttribute("hidden");
        if (!frameRequest) {
          lastDrawTime = 0;
          frameRequest = requestAnimationFrame(drawFrame);
        }
      } else {
        if (frameRequest) cancelAnimationFrame(frameRequest);
        frameRequest = 0;
        if (canvas && (!active || reducedMotion?.matches)) canvas.hidden = true;
        if (fluidCanvas && (!active || reducedMotion?.matches)) fluidCanvas.hidden = true;
      }
    };

    const onVisibilityChange = () => updateLoop();
    const onReducedMotionChange = () => updateLoop();
    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });
    reducedMotion?.addEventListener?.("change", onReducedMotionChange);

    const sync = (mode, nextHost) => {
      active = config.enabled && mode === "thread";
      if (active) ensureCanvas(nextHost);
      else {
        if (canvas) canvas.hidden = true;
        if (fluidCanvas) fluidCanvas.hidden = true;
      }
      updateLoop();
    };

    const sampleHash = () => {
      if (!portalGeometry) return null;
      let bytes;
      if (fluidAvailable && gl && fluidCanvas) {
        const scaleX = fluidCanvas.width / Math.max(1, portalGeometry.width);
        const scaleY = fluidCanvas.height / Math.max(1, portalGeometry.height);
        const sampleSize = 18;
        const sampleCenterX = portalGeometry.centerX + portalGeometry.radiusX * 0.52;
        const sampleCenterY = portalGeometry.centerY - portalGeometry.radiusY * 0.11;
        const sourceX = Math.max(0, Math.min(fluidCanvas.width - sampleSize, Math.round(sampleCenterX * scaleX - sampleSize / 2)));
        const sourceY = Math.max(0, Math.min(fluidCanvas.height - sampleSize, Math.round((portalGeometry.height - sampleCenterY) * scaleY - sampleSize / 2)));
        bytes = new Uint8Array(sampleSize * sampleSize * 4);
        gl.readPixels(sourceX, sourceY, sampleSize, sampleSize, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      } else {
        if (!context || !canvas) return null;
        const ratio = canvas.width / Math.max(1, portalGeometry.width);
        const sampleSize = Math.max(16, Math.round(24 * ratio));
        const sourceX = Math.max(0, Math.min(canvas.width - sampleSize, Math.round(portalGeometry.centerX * ratio - sampleSize / 2)));
        const sourceY = Math.max(0, Math.min(canvas.height - sampleSize, Math.round(portalGeometry.centerY * ratio - sampleSize / 2)));
        bytes = context.getImageData(sourceX, sourceY, sampleSize, sampleSize).data;
      }
      let hash = 2166136261;
      for (let index = 0; index < bytes.length; index += 7) {
        hash ^= bytes[index];
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    };

    const snapshot = () => {
      const canvasStyle = canvas ? getComputedStyle(canvas) : null;
      const fluidStyle = fluidCanvas ? getComputedStyle(fluidCanvas) : null;
      const hostStyle = host ? getComputedStyle(host) : null;
      const canvasBehindContent = Number.parseInt(canvasStyle?.zIndex || "0", 10) < 0;
      const fluidBehindContent = Number.parseInt(fluidStyle?.zIndex || "0", 10) < 0;
      const portalClipActive = Boolean(canvasStyle?.clipPath && canvasStyle.clipPath !== "none");
      return {
      enabled: config.enabled,
      active,
      running: Boolean(frameRequest) && shouldAnimate(),
      reducedMotion: Boolean(reducedMotion?.matches),
      hidden: document.hidden,
      canvasPresent: Boolean(canvas?.isConnected),
      canvasCount: document.querySelectorAll(`#${MOTION_CANVAS_ID}`).length,
      fluidCanvasPresent: Boolean(fluidCanvas?.isConnected),
      fluidCanvasCount: document.querySelectorAll(`#${FLUID_CANVAS_ID}`).length,
      fluidAvailable,
      fluidTextureReady,
      fluidTextureSize: fluidTextureImage?.naturalWidth
        ? `${fluidTextureImage.naturalWidth}x${fluidTextureImage.naturalHeight}`
        : null,
      fluidFailure,
      visuallyContained: canvasBehindContent && fluidBehindContent && portalClipActive && hostStyle?.isolation === "isolate",
      layers: {
        canvasZIndex: canvasStyle?.zIndex || null,
        fluidZIndex: fluidStyle?.zIndex || null,
        portalClipActive,
        hostIsolation: hostStyle?.isolation || null,
      },
      frameCount,
      targetFps: currentFps,
      visualMode: fluidAvailable && fluidTextureReady ? "textured-liquid-vortex" : "soft-glow-fallback",
      particleCount: 0,
      rollingDrawMs: Number(rollingDrawMs.toFixed(3)),
      portal: portalGeometry ? {
        centerX: Math.round(portalGeometry.centerX),
        centerY: Math.round(portalGeometry.centerY),
        radiusX: Math.round(portalGeometry.radiusX),
        radiusY: Math.round(portalGeometry.radiusY),
        scale: Number(portalGeometry.scale.toFixed(3)),
      } : null,
      sampleHash: sampleHash(),
      };
    };

    const destroy = () => {
      destroyed = true;
      active = false;
      if (frameRequest) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion?.removeEventListener?.("change", onReducedMotionChange);
      canvas?.remove();
      fluidCanvas?.remove();
      canvas = null;
      context = null;
      fluidCanvas = null;
      if (gl && fluidTexture) gl.deleteTexture(fluidTexture);
      gl = null;
      fluidProgram = null;
      fluidUniforms = null;
      fluidTexture = null;
      fluidTextureReady = false;
      if (fluidTextureImage) {
        fluidTextureImage.onload = null;
        fluidTextureImage.onerror = null;
      }
      fluidTextureImage = null;
      host = null;
    };

    const renderOnce = (time = performance.now()) => renderScene(time);

    return { sync, resize, destroy, snapshot, sampleHash, renderOnce };
  };

  const motion = createPortalMotion(themeMeta.motion || {}, portalTextureUrl);

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
    root.style.setProperty("--portal-work-foreground", `url("${workForegroundUrl}")`);
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
    motion.sync(mode, shellMain);
  };

  const cleanup = () => {
    window.__CODEX_DREAM_SKIN_DISABLED__ = true;
    const root = document.documentElement;
    root?.classList.remove(...ROOT_CLASSES);
    root?.style.removeProperty("--portal-home-art");
    root?.style.removeProperty("--portal-home-hero-art");
    root?.style.removeProperty("--portal-work-art");
    root?.style.removeProperty("--portal-work-foreground");
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
    state?.motion?.destroy?.();
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
    if (state?.workForegroundUrl) URL.revokeObjectURL(state.workForegroundUrl);
    if (state?.portalTextureUrl) URL.revokeObjectURL(state.portalTextureUrl);
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
    motion,
    homeArtUrl,
    homeHeroArtUrl,
    workArtUrl,
    workForegroundUrl,
    portalTextureUrl,
    version: themeMeta.version,
    theme: themeMeta.id,
  };
  ensure();
  return { installed: true, version: themeMeta.version, theme: themeMeta.id };
})(__PORTAL_CSS_JSON__, __PORTAL_HOME_ART_JSON__, __PORTAL_HOME_HERO_ART_JSON__, __PORTAL_WORK_ART_JSON__, __PORTAL_WORK_FOREGROUND_JSON__, __PORTAL_FLUID_TEXTURE_JSON__, __PORTAL_THEME_META_JSON__)
