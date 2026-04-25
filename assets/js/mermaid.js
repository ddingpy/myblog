(function () {
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;
  let activeViewer = null;

  function collectMermaidBlocks() {
    const preparedBlocks = [];
    const fencedBlocks = document.querySelectorAll(".language-mermaid");

    fencedBlocks.forEach((block) => {
      const container = block.closest(".highlighter-rouge") || block.closest("pre") || block;
      if (container.dataset.mermaidEnhanced === "true") {
        return;
      }

      const code = block.querySelector("code") || block;
      const source = code.textContent.trim();
      if (!source) {
        return;
      }

      const mermaidBlock = document.createElement("pre");
      mermaidBlock.className = "mermaid";
      mermaidBlock.textContent = source;
      mermaidBlock.dataset.mermaidEnhanced = "true";
      mermaidBlock.dataset.mermaidBound = "true";

      container.replaceWith(mermaidBlock);
      preparedBlocks.push(mermaidBlock);
    });

    document.querySelectorAll("pre.mermaid, div.mermaid").forEach((block) => {
      if (block.dataset.mermaidBound === "true") {
        return;
      }

      block.dataset.mermaidBound = "true";
      preparedBlocks.push(block);
    });

    return preparedBlocks;
  }

  function clampZoom(value) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }

  function getSvgSize(svg) {
    const viewBox = svg.viewBox && svg.viewBox.baseVal;
    if (viewBox && viewBox.width && viewBox.height) {
      return {
        width: viewBox.width,
        height: viewBox.height
      };
    }

    const rect = svg.getBoundingClientRect();
    return {
      width: rect.width || 960,
      height: rect.height || 540
    };
  }

  function updateViewerZoom(viewer, nextZoom) {
    const zoom = clampZoom(nextZoom);
    viewer.zoom = zoom;
    viewer.clone.style.width = `${Math.round(viewer.width * zoom)}px`;
    viewer.clone.style.height = `${Math.round(viewer.height * zoom)}px`;
    viewer.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    viewer.zoomOutButton.disabled = zoom <= MIN_ZOOM;
    viewer.zoomInButton.disabled = zoom >= MAX_ZOOM;
  }

  function closeDiagramViewer() {
    if (!activeViewer) {
      return;
    }

    const { dialog, opener } = activeViewer;
    dialog.remove();
    document.documentElement.classList.remove("mermaid-viewer-open");
    document.body.classList.remove("mermaid-viewer-open");
    activeViewer = null;

    if (opener && document.contains(opener)) {
      opener.focus();
    }
  }

  function openDiagramViewer(block, opener) {
    const sourceSvg = block.querySelector("svg");
    if (!sourceSvg) {
      return;
    }

    closeDiagramViewer();

    const dialog = document.createElement("div");
    dialog.className = "mermaid-viewer";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Mermaid diagram full view");

    const toolbar = document.createElement("div");
    toolbar.className = "mermaid-viewer-toolbar";

    const zoomOutButton = document.createElement("button");
    zoomOutButton.type = "button";
    zoomOutButton.className = "mermaid-viewer-button";
    zoomOutButton.setAttribute("aria-label", "Zoom out");
    zoomOutButton.textContent = "-";

    const zoomLabel = document.createElement("span");
    zoomLabel.className = "mermaid-viewer-zoom";

    const zoomInButton = document.createElement("button");
    zoomInButton.type = "button";
    zoomInButton.className = "mermaid-viewer-button";
    zoomInButton.setAttribute("aria-label", "Zoom in");
    zoomInButton.textContent = "+";

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "mermaid-viewer-button";
    resetButton.textContent = "Reset";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "mermaid-viewer-button";
    closeButton.textContent = "Close";

    toolbar.append(zoomOutButton, zoomLabel, zoomInButton, resetButton, closeButton);

    const stage = document.createElement("div");
    stage.className = "mermaid-viewer-stage";
    stage.tabIndex = -1;

    const canvas = document.createElement("div");
    canvas.className = "mermaid-viewer-canvas";

    const clone = sourceSvg.cloneNode(true);
    clone.style.maxWidth = "none";

    canvas.appendChild(clone);
    stage.appendChild(canvas);
    dialog.append(toolbar, stage);
    document.documentElement.classList.add("mermaid-viewer-open");
    document.body.classList.add("mermaid-viewer-open");
    document.body.appendChild(dialog);

    const size = getSvgSize(sourceSvg);
    activeViewer = {
      clone,
      dialog,
      height: size.height,
      opener,
      width: size.width,
      zoom: 1,
      zoomInButton,
      zoomLabel,
      zoomOutButton
    };

    zoomOutButton.addEventListener("click", () => {
      updateViewerZoom(activeViewer, activeViewer.zoom - ZOOM_STEP);
    });
    zoomInButton.addEventListener("click", () => {
      updateViewerZoom(activeViewer, activeViewer.zoom + ZOOM_STEP);
    });
    resetButton.addEventListener("click", () => {
      updateViewerZoom(activeViewer, 1);
      stage.scrollTo({ left: 0, top: 0 });
    });
    closeButton.addEventListener("click", closeDiagramViewer);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeDiagramViewer();
      }
    });

    updateViewerZoom(activeViewer, 1);
    closeButton.focus();
  }

  function enhanceDiagramBlock(block) {
    if (block.dataset.mermaidViewerEnhanced === "true" || !block.querySelector("svg")) {
      return;
    }

    block.dataset.mermaidViewerEnhanced = "true";
    block.classList.add("mermaid-diagram-trigger");
    block.tabIndex = 0;
    block.setAttribute("role", "button");
    block.setAttribute("aria-label", "Open Mermaid diagram full view");

    block.addEventListener("click", (event) => {
      if (event.defaultPrevented || (event instanceof MouseEvent && event.button !== 0)) {
        return;
      }

      openDiagramViewer(block, block);
    });

    block.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openDiagramViewer(block, block);
    });
  }

  function enhanceRenderedDiagrams(blocks) {
    blocks.forEach(enhanceDiagramBlock);
  }

  function renderMermaid() {
    if (!window.mermaid) {
      return;
    }

    const mermaidBlocks = collectMermaidBlocks();
    if (!mermaidBlocks.length) {
      return;
    }

    window.mermaid.initialize({
      startOnLoad: false,
      theme: "neutral"
    });

    try {
      if (typeof window.mermaid.run === "function") {
        const renderTask = window.mermaid.run({
          nodes: mermaidBlocks
        });
        if (renderTask && typeof renderTask.then === "function") {
          renderTask
            .then(() => {
              enhanceRenderedDiagrams(mermaidBlocks);
            })
            .catch((error) => {
              console.error("Failed to render Mermaid diagrams.", error);
              mermaidBlocks.forEach((block) => {
                block.dataset.mermaidError = "true";
              });
            });
        }
        if (!renderTask || typeof renderTask.then !== "function") {
          enhanceRenderedDiagrams(mermaidBlocks);
        }
        return;
      }

      window.mermaid.init(undefined, mermaidBlocks);
      enhanceRenderedDiagrams(mermaidBlocks);
    } catch (error) {
      console.error("Failed to render Mermaid diagrams.", error);
      mermaidBlocks.forEach((block) => {
        block.dataset.mermaidError = "true";
      });
    }
  }

  document.addEventListener("keydown", (event) => {
    if (!activeViewer) {
      return;
    }

    if (event.key === "Escape") {
      closeDiagramViewer();
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      updateViewerZoom(activeViewer, activeViewer.zoom + ZOOM_STEP);
      return;
    }

    if (event.key === "-") {
      event.preventDefault();
      updateViewerZoom(activeViewer, activeViewer.zoom - ZOOM_STEP);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderMermaid, { once: true });
    return;
  }

  renderMermaid();
}());
