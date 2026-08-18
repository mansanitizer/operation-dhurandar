/**
 * Operation Dhurandar - In Memoriam Card Generator & External Share Controller
 * Generates high-resolution patriotic tribute posters on HTML5 Canvas and
 * provides seamless 1-click sharing to WhatsApp, X/Twitter, Telegram, Facebook,
 * Native Web Share API, Clipboard, and direct PNG download.
 */

// Helper to wrap text cleanly on canvas
function wrapCanvasText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Helper to draw rounded rectangle
function drawRoundedRect(ctx, x, y, width, height, radius, fill = false, stroke = true) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// Helper to load image safely with fallbacks
function loadImageSafe(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Try local fallback if remote failed
      if (src.startsWith('http')) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = () => resolve(null);
        fallbackImg.src = 'https://dhurandar-assets.pages.dev/ui/hero_memorial.jpg';
      } else {
        resolve(null);
      }
    };
    img.src = src;
  });
}

/**
 * Generate a high-resolution 1080x1350 Patriotic Memorial Poster Image
 * @param {Object} hero 
 * @returns {Promise<{blob: Blob, dataUrl: string, filename: string, hero: Object}>}
 */
export async function generateMemorialImage(hero = {}) {
  const width = 1080;
  const height = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. Background Gradient (Tactical Deep Carbon)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#0e1524');
  bgGrad.addColorStop(1, '#05070d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle tactical grid background
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 40; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Tactical Corner Brackets (Gold)
  const pad = 36;
  const bLen = 40;
  ctx.strokeStyle = '#e5a93c';
  ctx.lineWidth = 3;
  // Top-Left
  ctx.beginPath();
  ctx.moveTo(pad, pad + bLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + bLen, pad);
  ctx.stroke();
  // Top-Right
  ctx.beginPath();
  ctx.moveTo(width - pad - bLen, pad); ctx.lineTo(width - pad, pad); ctx.lineTo(width - pad, pad + bLen);
  ctx.stroke();
  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(pad, height - pad - bLen); ctx.lineTo(pad, height - pad); ctx.lineTo(pad + bLen, height - pad);
  ctx.stroke();
  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(width - pad - bLen, height - pad); ctx.lineTo(width - pad, height - pad); ctx.lineTo(width - pad, height - pad - bLen);
  ctx.stroke();

  // Outer Border Box
  ctx.strokeStyle = 'rgba(229, 169, 60, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 10, pad + 10, width - 2 * (pad + 10), height - 2 * (pad + 10));

  // 2. Top Indian Tricolor Header Ribbon (Saffron, White, Green)
  const barY = 56;
  const barH = 10;
  const barW = (width - 120) / 3;
  const startX = 60;
  
  ctx.fillStyle = '#FF9933'; // Saffron
  ctx.fillRect(startX, barY, barW, barH);
  ctx.fillStyle = '#FFFFFF'; // White
  ctx.fillRect(startX + barW, barY, barW, barH);
  ctx.fillStyle = '#138808'; // Green
  ctx.fillRect(startX + 2 * barW, barY, barW, barH);

  // 3. Header Texts
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e5a93c';
  ctx.font = '600 16px "Courier New", monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText('OPERATION DHURANDAR // TACTICAL COMMENDATION', width / 2, 95);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('IN MEMORIAM', width / 2, 140);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 17px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('DEDICATED TO THE IMMORTAL GUARDIANS OF THE NATION', width / 2, 170);

  // 4. Hero Portrait Photo Box
  const imgW = 340;
  const imgH = 400;
  const imgX = (width - imgW) / 2;
  const imgY = 200;

  // Outer glow & border
  ctx.save();
  ctx.shadowColor = 'rgba(229, 169, 60, 0.4)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#0f172a';
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 12, true, false);
  ctx.restore();

  // Load hero image
  let heroImg = null;
  if (hero.id) {
    heroImg = await loadImageSafe(`https://dhurandar-assets.pages.dev/heroes/${hero.id}.jpg`);
  }
  if (!heroImg && hero.image) {
    heroImg = await loadImageSafe(hero.image);
  }
  if (!heroImg) {
    heroImg = await loadImageSafe('https://dhurandar-assets.pages.dev/ui/hero_memorial.jpg');
  }

  // Draw clipped image
  ctx.save();
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 12, false, false);
  ctx.clip();

  if (heroImg) {
    // Draw image covering the box while preserving aspect ratio
    const imgAspect = heroImg.width / heroImg.height;
    const boxAspect = imgW / imgH;
    let renderW, renderH, renderX, renderY;

    if (imgAspect > boxAspect) {
      renderH = imgH;
      renderW = imgH * imgAspect;
      renderX = imgX - (renderW - imgW) / 2;
      renderY = imgY;
    } else {
      renderW = imgW;
      renderH = imgW / imgAspect;
      renderX = imgX;
      renderY = imgY - (renderH - imgH) / 2;
    }
    ctx.drawImage(heroImg, renderX, renderY, renderW, renderH);
  } else {
    // Elegant patriotic placeholder
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(imgX, imgY, imgW, imgH);
    ctx.fillStyle = '#e5a93c';
    ctx.font = 'bold 50px serif';
    ctx.fillText('🇮🇳', imgX + imgW / 2, imgY + imgH / 2 - 20);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(hero.name || 'HERO OF INDIA', imgX + imgW / 2, imgY + imgH / 2 + 30);
  }
  ctx.restore();

  // Golden Frame around image
  ctx.strokeStyle = '#e5a93c';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 12, false, true);

  // Gallantry Decoration Ribbon Badge (Overlaid on bottom of photo)
  const decBadgeH = 34;
  const decBadgeY = imgY + imgH - decBadgeH;
  ctx.fillStyle = 'rgba(184, 28, 44, 0.95)';
  ctx.fillRect(imgX + 2, decBadgeY, imgW - 4, decBadgeH);
  ctx.strokeStyle = '#e5a93c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(imgX + 2, decBadgeY, imgW - 4, decBadgeH);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`★ ${(hero.decoration || 'PARAM VIR CHAKRA').toUpperCase()} ★`, imgX + imgW / 2, decBadgeY + 22);

  // 5. Hero Details Section
  let curY = 635;

  // Hero Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(hero.name || 'Major Sandeep Unnikrishnan, AC', width / 2, curY);

  // Rank & Unit
  curY += 34;
  ctx.fillStyle = '#e5a93c';
  ctx.font = '600 20px "Courier New", monospace';
  const unitText = `${hero.rank || 'Martyr'} • ${hero.unit || 'Indian Armed Forces'}`;
  ctx.fillText(unitText, width / 2, curY);

  // Operation / Mission
  curY += 28;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 17px "Segoe UI", Roboto, Arial, sans-serif';
  const opText = `${hero.operation || 'Supreme Sacrifice in Defense of Motherland'}${hero.dateOfMartyrdom ? ' (' + hero.dateOfMartyrdom + ')' : ''}`;
  ctx.fillText(opText, width / 2, curY);

  // 6. Inspiring Quote Block
  if (hero.quote) {
    curY += 28;
    const qBoxW = 840;
    const qBoxX = (width - qBoxW) / 2;
    
    // Measure quote
    ctx.font = 'italic 20px "Georgia", serif';
    const quoteLines = wrapCanvasText(ctx, hero.quote, qBoxW - 60);
    const qBoxH = Math.max(54, quoteLines.length * 28 + 24);

    // Quote Box Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    drawRoundedRect(ctx, qBoxX, curY, qBoxW, qBoxH, 8, true, false);

    // Golden Left Border Bar
    ctx.fillStyle = '#e5a93c';
    ctx.fillRect(qBoxX, curY, 5, qBoxH);

    // Quote text
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    quoteLines.forEach((line, idx) => {
      ctx.fillText(line, width / 2, curY + 28 + (idx * 28));
    });

    curY += qBoxH + 16;
  } else {
    curY += 20;
  }

  // 7. Writeup / Narrative of Valour
  if (hero.writeUp) {
    const textW = 820;
    ctx.font = '400 17px "Segoe UI", Roboto, Arial, sans-serif';
    const writeupLines = wrapCanvasText(ctx, hero.writeUp, textW);
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';

    // Limit to max 4 lines so it doesn't overflow
    const maxLines = Math.min(writeupLines.length, 4);
    for (let i = 0; i < maxLines; i++) {
      ctx.fillText(writeupLines[i], width / 2, curY + (i * 24));
    }
    curY += (maxLines * 24) + 16;
  }

  // 8. Live Salutes Recorded Pill Badge
  const saluteCount = hero.salutesCount || 1947;
  const badgeText = `🇮🇳 ${saluteCount.toLocaleString()} NATIONAL SALUTES RECORDED`;
  ctx.font = 'bold 16px "Courier New", monospace';
  const badgeW = ctx.measureText(badgeText).width + 48;
  const badgeH = 38;
  const badgeX = (width - badgeW) / 2;
  const badgeY = height - 150;

  ctx.fillStyle = 'rgba(255, 153, 51, 0.15)';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 19, true, false);
  ctx.strokeStyle = 'rgba(255, 153, 51, 0.7)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 19, false, true);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, width / 2, badgeY + 24);

  // 9. Bottom Footer Ribbon & Watermark
  const bBarY = height - 76;
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(startX, bBarY, barW, 6);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(startX + barW, bBarY, barW, 6);
  ctx.fillStyle = '#138808';
  ctx.fillRect(startX + 2 * barW, bBarY, barW, 6);

  ctx.fillStyle = '#e5a93c';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText('JAI HIND 🇮🇳 | VIRTUAL MEMORIAL PROTOCOL | NEVER FORGET', width / 2, height - 44);

  // Export to Blob and DataURL
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const dataUrl = canvas.toDataURL('image/png');
      const cleanName = (hero.name || 'Hero').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Tribute_${cleanName}_OperationDhurandar.png`;
      resolve({ canvas, blob, dataUrl, filename, hero });
    }, 'image/png');
  });
}

/**
 * Trigger Native Web Share or open the Share Modal
 */
export async function shareMemorialHero(hero = {}, options = {}) {
  // Show generating toast/spinner if needed
  showShareToast('GENERATING TRIBUTE CARD...', 'loading');

  try {
    const result = await generateMemorialImage(hero);
    hideShareToast();

    // If native sharing is explicitly requested or on supported mobile
    if (options.preferNative && navigator.share && navigator.canShare) {
      try {
        const file = new File([result.blob], result.filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `In Memoriam: ${hero.name} | Operation Dhurandar`,
            text: `🇮🇳 Honoring the supreme sacrifice of ${hero.name} (${hero.decoration}). Jai Hind! #OperationDhurandar #IndianArmedForces`,
            url: window.location.href,
            files: [file]
          });
          showShareToast('TRIBUTE SHARED WITH HIGHEST HONORS 🇮🇳', 'success');
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[Share] Native file share skipped, opening tactical modal:', err);
        } else {
          return; // User cancelled native share sheet
        }
      }
    }

    // Open rich tactical share modal
    openMemorialShareModal(result);
  } catch (err) {
    console.error('[Share] Failed to generate memorial image:', err);
    hideShareToast();
    showShareToast('FAILED TO GENERATE TRIBUTE IMAGE', 'error');
  }
}

/**
 * Open the interactive Memorial Share Modal
 */
export function openMemorialShareModal(shareData) {
  const modal = document.getElementById('share-memorial-modal');
  if (!modal) return;

  const { dataUrl, filename, blob, hero } = shareData;

  // Set preview image
  const previewImg = document.getElementById('share-modal-preview');
  if (previewImg) previewImg.src = dataUrl;

  // Set title & meta
  const titleElem = document.getElementById('share-modal-hero-title');
  if (titleElem) titleElem.textContent = hero.name || 'Hero of the Nation';

  const decElem = document.getElementById('share-modal-hero-dec');
  if (decElem) decElem.textContent = hero.decoration || 'Gallantry Award';

  // Compose share texts
  const shareText = `🇮🇳 Honoring the supreme sacrifice of ${hero.name} (${hero.decoration}) in ${hero.operation || 'the line of duty'}. Jai Hind! Never Forget.\n\nSalute our bravehearts at Operation Dhurandar:`;
  const shareUrl = window.location.origin || window.location.href;

  // Setup Download Action
  const btnDownload = document.getElementById('btn-share-download');
  if (btnDownload) {
    btnDownload.onclick = () => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showShareToast('TRIBUTE POSTER DOWNLOADED 📥', 'success');
    };
  }

  // Setup Copy Image Action
  const btnCopy = document.getElementById('btn-share-copy');
  if (btnCopy) {
    btnCopy.onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showShareToast('TRIBUTE POSTER COPIED TO CLIPBOARD! 📋', 'success');
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
          showShareToast('TRIBUTE TEXT COPIED TO CLIPBOARD! 📋', 'success');
        }
      } catch (err) {
        console.warn('[Copy] Image copy failed, copying text:', err);
        navigator.clipboard?.writeText?.(`${shareText}\n${shareUrl}`);
        showShareToast('TRIBUTE TEXT COPIED TO CLIPBOARD! 📋', 'success');
      }
    };
  }

  // Setup WhatsApp Share
  const btnWhatsApp = document.getElementById('btn-share-whatsapp');
  if (btnWhatsApp) {
    btnWhatsApp.onclick = () => {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    };
  }

  // Setup X / Twitter Share
  const btnTwitter = document.getElementById('btn-share-twitter');
  if (btnTwitter) {
    btnTwitter.onclick = () => {
      const twText = `🇮🇳 Honoring the supreme sacrifice of ${hero.name} (${hero.decoration}). Jai Hind! #OperationDhurandar #IndianArmedForces #JaiHind`;
      const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twText)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(twUrl, '_blank', 'noopener,noreferrer');
    };
  }

  // Setup Telegram Share
  const btnTelegram = document.getElementById('btn-share-telegram');
  if (btnTelegram) {
    btnTelegram.onclick = () => {
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
      window.open(tgUrl, '_blank', 'noopener,noreferrer');
    };
  }

  // Setup Facebook Share
  const btnFacebook = document.getElementById('btn-share-facebook');
  if (btnFacebook) {
    btnFacebook.onclick = () => {
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
      window.open(fbUrl, '_blank', 'noopener,noreferrer');
    };
  }

  // Setup Native Share Trigger from inside modal if supported
  const btnNative = document.getElementById('btn-share-native');
  if (btnNative) {
    if (navigator.share) {
      btnNative.style.display = 'flex';
      btnNative.onclick = async () => {
        try {
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `In Memoriam: ${hero.name}`,
              text: shareText,
              url: shareUrl,
              files: [file]
            });
          } else {
            await navigator.share({
              title: `In Memoriam: ${hero.name}`,
              text: shareText,
              url: shareUrl
            });
          }
          showShareToast('TRIBUTE SHARED WITH HONORS 🇮🇳', 'success');
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('Native share failed:', e);
        }
      };
    } else {
      btnNative.style.display = 'none';
    }
  }

  // Show Modal with animation
  modal.classList.add('active');
  modal.style.display = 'flex';
}

/**
 * Close the Memorial Share Modal
 */
export function closeMemorialShareModal() {
  const modal = document.getElementById('share-memorial-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

/**
 * Tactical Share Toast Notification
 */
export function showShareToast(message, type = 'info') {
  let toast = document.getElementById('share-feedback-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-feedback-toast';
    toast.className = 'share-feedback-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `share-feedback-toast show ${type}`;

  if (type !== 'loading') {
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

export function hideShareToast() {
  const toast = document.getElementById('share-feedback-toast');
  if (toast) toast.classList.remove('show');
}
