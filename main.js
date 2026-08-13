const $ = (sel, root = document) => root.querySelector(sel);

const yearEl = $("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---------- Scroll reveal (fallback for browsers without animation-timeline) ----------
const supportsScrollDrivenAnimation =
  typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()");

if (!supportsScrollDrivenAnimation) {
  const targets = document.querySelectorAll("[data-reveal]");
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 }
  );
  targets.forEach((el) => io.observe(el));
}

// ---------- Tabs ----------
const tabImages = $("#tab-images");
const tabPdf = $("#tab-pdf");
const panelImages = $("#panel-images");
const panelPdf = $("#panel-pdf");

let pdfToolLoaded = false;

function activateTab(name) {
  const isImages = name === "images";
  tabImages.setAttribute("aria-selected", String(isImages));
  tabPdf.setAttribute("aria-selected", String(!isImages));
  panelImages.hidden = !isImages;
  panelPdf.hidden = isImages;

  if (!isImages && !pdfToolLoaded) {
    pdfToolLoaded = true;
    import("/pdf-tool.js")
      .then((mod) => mod.initPdfTool())
      .catch((err) => {
        console.error("Failed to load PDF tool", err);
      });
  }
}

tabImages.addEventListener("click", () => activateTab("images"));
tabPdf.addEventListener("click", () => activateTab("pdf"));

// ---------- Shared helpers ----------
function bytesToSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function drawThumb(bitmap, maxSize = 128) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// ---------- Image tool ----------
const imageDropzone = $("#image-dropzone");
const imageInput = $("#image-input");
const imageFormatSelect = $("#image-format");
const imageQualityInput = $("#image-quality");
const imageQualityOut = $("#image-quality-out");
const imageFileList = $("#image-file-list");

imageQualityInput.addEventListener("input", () => {
  imageQualityOut.textContent = imageQualityInput.value;
});

imageDropzone.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => {
  handleImageFiles(imageInput.files);
  imageInput.value = "";
});

["dragover", "dragleave", "drop"].forEach((evtName) => {
  imageDropzone.addEventListener(evtName, (e) => {
    e.preventDefault();
    if (evtName === "dragover") imageDropzone.classList.add("is-dragover");
    if (evtName === "dragleave" || evtName === "drop") imageDropzone.classList.remove("is-dragover");
  });
});
imageDropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer?.files?.length) handleImageFiles(e.dataTransfer.files);
});

async function handleImageFiles(fileList) {
  for (const file of Array.from(fileList)) {
    if (!file.type.startsWith("image/")) continue;
    await processOneImage(file);
  }
}

async function processOneImage(file) {
  const card = document.createElement("div");
  card.className = "file-card";
  card.innerHTML = `
    <canvas width="64" height="64"></canvas>
    <div>
      <p class="file-card-name">${escapeHtml(file.name)}</p>
      <p class="file-card-meta">${bytesToSize(file.size)} → processing…</p>
    </div>
  `;
  imageFileList.prepend(card);

  const thumbSlot = card.querySelector("canvas");
  const metaEl = card.querySelector(".file-card-meta");

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    metaEl.textContent = /heic|heif/i.test(file.type + file.name)
      ? "HEIC isn't supported yet — convert to JPG first"
      : "Couldn't read this file";
    return;
  }

  const thumb = drawThumb(bitmap, 128);
  thumbSlot.replaceWith(thumb);
  thumb.width = 64;
  thumb.height = 64;

  const format = imageFormatSelect.value;
  const quality = Number(imageQualityInput.value) / 100;
  const mimeType = format === "keep" ? file.type || "image/png" : `image/${format}`;
  const supportsQuality = mimeType === "image/jpeg" || mimeType === "image/webp";

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        metaEl.textContent = "Couldn't encode this file";
        return;
      }
      const savedPct = Math.max(0, Math.round((1 - blob.size / file.size) * 100));
      metaEl.innerHTML = `${bytesToSize(file.size)} → ${bytesToSize(blob.size)} <span class="saved">(-${savedPct}%)</span>`;

      const downloadBtn = document.createElement("a");
      downloadBtn.className = "btn btn-primary btn-small";
      downloadBtn.textContent = "Download";
      downloadBtn.href = URL.createObjectURL(blob);
      const ext = mimeType.split("/")[1];
      downloadBtn.download = file.name.replace(/\.[^.]+$/, "") + "." + (ext === "jpeg" ? "jpg" : ext);
      card.appendChild(downloadBtn);
    },
    mimeType,
    supportsQuality ? quality : undefined
  );
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
