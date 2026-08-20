const slugify = require('slugify');

function makeSlug(text) {
  return slugify(text, { lower: true, strict: true, locale: 'vi' }) + '-' + Math.random().toString(36).substring(2, 7);
}

function genActivationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part()}-${part()}-${part()}`;
}

function genCertCode() {
  return 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN');
}

// Nhan dien link video (Youtube/Vimeo/Google Drive/nguon khac) de nhung xem truoc,
// dung chung cho: video gioi thieu khoa hoc, bang tin cong dong, video bai hoc
function embedVideoInfo(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return { type: 'youtube', id: yt[1] };
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { type: 'vimeo', id: vm[1] };
  if (url.includes('drive.google.com')) return { type: 'drive', embedUrl: url.replace('/view', '/preview') };
  return { type: 'external', url };
}

// Chuyen link PDF (Google Drive hoac link PDF bat ky) thanh link nhung xem truc tiep trong trang,
// khong mo tab moi. Dung Google Docs Viewer lam phuong an du phong cho link PDF thuong.
function embedPdfUrl(url) {
  if (!url) return null;
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview');
  if (/\.pdf($|\?)/i.test(url)) return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  return url;
}

// Chuyen link chia se Google Drive (dang /file/d/XXXX/view) thanh link tai truc tiep (uc?export=download&id=XXXX)
// Link tu cac noi luu tru khac (S3, CDN, link .pdf truc tiep...) duoc giu nguyen
function resolveDirectDownloadUrl(url) {
  if (!url) return url;
  const idMatch = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || url.match(/drive\.google\.com\/open\?id=([\w-]+)/);
  if (idMatch) return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
  return url;
}

module.exports = { makeSlug, genActivationCode, genCertCode, formatVND, formatDate, embedVideoInfo, embedPdfUrl, resolveDirectDownloadUrl };
