let libheifPromise = null;

function ensureLibheif() {
  if (!libheifPromise) {
    libheifPromise = import("/vendor/libheif-bundle.js").then((mod) => mod.default);
  }
  return libheifPromise;
}

export function isHeicFile(file) {
  return /image\/heic|image\/heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

// Decodes the first image in a HEIC/HEIF file and draws it onto a canvas,
// so it can be dropped straight into the existing image pipeline.
export async function decodeHeicToCanvas(file) {
  const libheif = await ensureLibheif();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(bytes);
  if (!images || images.length === 0) {
    throw new Error("No image found in this HEIC file");
  }

  const heifImage = images[0];
  const width = heifImage.get_width();
  const height = heifImage.get_height();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);

  await new Promise((resolve, reject) => {
    heifImage.display(imageData, (displayData) => {
      if (!displayData) {
        reject(new Error("HEIC decode failed"));
      } else {
        resolve();
      }
    });
  });

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
