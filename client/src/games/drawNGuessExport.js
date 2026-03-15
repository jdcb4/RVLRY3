const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export async function exportDrawNGuessChainImage({
  entries,
  playersById,
  title,
  subtitle,
  filename
}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas export is unavailable');
  }

  const width = 1080;
  const padding = 48;
  const blockGap = 28;
  const titleHeight = 140;
  const rowHeights = entries.map((entry) => (entry.type === 'drawing' ? 420 : 140));
  const height =
    titleHeight +
    padding * 2 +
    rowHeights.reduce((total, value) => total + value, 0) +
    blockGap * Math.max(rowHeights.length - 1, 0);

  canvas.width = width;
  canvas.height = height;

  context.fillStyle = '#f4efe5';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#13211d';
  context.font = '700 46px Georgia, serif';
  context.fillText(title, padding, 90);
  context.font = '500 28px Arial, sans-serif';
  context.fillText(subtitle, padding, 128);

  let y = titleHeight;
  for (const [index, entry] of entries.entries()) {
    const blockHeight = rowHeights[index];
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#d6cdbf';
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(padding, y, width - padding * 2, blockHeight, 28);
    context.fill();
    context.stroke();

    context.fillStyle = '#5b6059';
    context.font = '600 24px Arial, sans-serif';
    const label =
      entry.type === 'prompt' ? 'Prompt' : entry.type === 'drawing' ? 'Drawing' : 'Guess';
    context.fillText(label, padding + 26, y + 42);

    if (entry.submittedBy) {
      context.fillStyle = '#13211d';
      context.font = '600 26px Arial, sans-serif';
      context.fillText(playersById.get(entry.submittedBy) ?? 'Player', padding + 150, y + 42);
    }

    if (entry.type === 'drawing') {
      const image = await loadImage(entry.imageData);
      context.drawImage(image, padding + 26, y + 64, width - padding * 2 - 52, blockHeight - 90);
    } else {
      context.fillStyle = '#13211d';
      context.font = '500 36px Arial, sans-serif';
      context.fillText(entry.text ?? '', padding + 26, y + 92, width - padding * 2 - 52);
    }

    y += blockHeight + blockGap;
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('Could not export the reveal chain');
  }

  const imageFile = new File([blob], filename, { type: 'image/png' });
  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [imageFile] })
  ) {
    try {
      await navigator.share({
        title,
        text: subtitle,
        files: [imageFile]
      });
      return;
    } catch {
      // Fall back to download if the share flow is cancelled or unavailable.
    }
  }

  downloadBlob(blob, filename);
}
