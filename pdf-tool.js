function bytesToSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

const RENDER_SCALE = 1.5;

let pdfjsLib = null;
let pdfLibReady = null;

async function ensureLibraries() {
  if (!pdfjsLib) {
    pdfjsLib = await import("/vendor/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  }
  if (!pdfLibReady) {
    pdfLibReady = window.PDFLib ? Promise.resolve() : loadClassicScript("/vendor/pdf-lib.min.js");
  }
  await pdfLibReady;
}

export function initPdfTool() {
  const dropzone = document.getElementById("pdf-dropzone");
  const input = document.getElementById("pdf-input");
  const qualityInput = document.getElementById("pdf-quality");
  const qualityOut = document.getElementById("pdf-quality-out");
  const statusCard = document.getElementById("pdf-status");
  const statusName = document.getElementById("pdf-status-name");
  const statusMeta = document.getElementById("pdf-status-meta");
  const progressFill = document.getElementById("pdf-progress-fill");
  const downloadBtn = document.getElementById("pdf-download");

  qualityInput.addEventListener("input", () => {
    qualityOut.textContent = qualityInput.value;
  });

  dropzone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    if (input.files?.[0]) processPdf(input.files[0]);
    input.value = "";
  });

  ["dragover", "dragleave", "drop"].forEach((evtName) => {
    dropzone.addEventListener(evtName, (e) => {
      e.preventDefault();
      if (evtName === "dragover") dropzone.classList.add("is-dragover");
      if (evtName === "dragleave" || evtName === "drop") dropzone.classList.remove("is-dragover");
    });
  });
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) processPdf(file);
  });

  async function processPdf(file) {
    if (file.type !== "application/pdf") {
      return;
    }

    statusCard.hidden = false;
    downloadBtn.hidden = true;
    statusName.textContent = file.name;
    statusMeta.textContent = "Loading…";
    progressFill.style.width = "0%";

    try {
      await ensureLibraries();

      const sourceBytes = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: sourceBytes.slice(0) });
      const pdf = await loadingTask.promise;
      const quality = Number(qualityInput.value) / 100;

      const { PDFDocument } = window.PDFLib;
      const outputPdf = await PDFDocument.create();

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        statusMeta.textContent = `Rendering page ${pageNum} of ${pdf.numPages}…`;

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        const jpegBlob = await new Promise((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality)
        );
        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
        const jpegImage = await outputPdf.embedJpg(jpegBytes);

        const outPage = outputPdf.addPage([viewport.width, viewport.height]);
        outPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });

        progressFill.style.width = `${Math.round((pageNum / pdf.numPages) * 100)}%`;

        canvas.width = 0;
        canvas.height = 0;
      }

      statusMeta.textContent = "Finalizing…";
      const outputBytes = await outputPdf.save();
      const outputBlob = new Blob([outputBytes], { type: "application/pdf" });

      const savedPct = Math.max(0, Math.round((1 - outputBlob.size / file.size) * 100));
      statusMeta.innerHTML = `${bytesToSize(file.size)} → ${bytesToSize(outputBlob.size)} <span class="saved">(-${savedPct}%)</span>`;

      downloadBtn.href = URL.createObjectURL(outputBlob);
      downloadBtn.download = file.name.replace(/\.pdf$/i, "") + "-compressed.pdf";
      downloadBtn.hidden = false;
    } catch (err) {
      console.error(err);
      statusMeta.textContent = "Something went wrong reading this PDF.";
    }
  }
}
