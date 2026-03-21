(function () {
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
        if (renderTask && typeof renderTask.catch === "function") {
          renderTask.catch((error) => {
            console.error("Failed to render Mermaid diagrams.", error);
            mermaidBlocks.forEach((block) => {
              block.dataset.mermaidError = "true";
            });
          });
        }
        return;
      }

      window.mermaid.init(undefined, mermaidBlocks);
    } catch (error) {
      console.error("Failed to render Mermaid diagrams.", error);
      mermaidBlocks.forEach((block) => {
        block.dataset.mermaidError = "true";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderMermaid, { once: true });
    return;
  }

  renderMermaid();
}());
