// Chuyen doi cong thuc OMML (dinh dang cong thuc goc cua cong cu Equation trong Word)
// sang MathML - trinh duyet + MathJax hien thi duoc dep, dung nhu cong thuc Toan chuan tren web.
// Bao phu cac ky hieu thuong gap trong de thi: phan so, mu, chi so duoi, can, tong/tich phan,
// dau ngoac, ky hieu Hy Lap... Cac cau truc qua hiem/phuc tap co the chua chuyen het,
// nen luon can xem lai o man hinh xem truoc truoc khi luu (giong het co che hien tai).

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Doi ten ky hieu Word (vd "\alpha") thanh chu Hy Lap that su
function mapSymbol(t) {
  const m = t.match(/^\\([A-Za-z]+)$/);
  if (m && GREEK[m[1]]) return GREEK[m[1]];
  return t;
}

// node dang object tu fast-xml-parser (che do preserveOrder), duyet de tim cac phan tu con theo ten tag
function children(node, tagName) {
  if (!node || !Array.isArray(node)) return [];
  return node.filter(n => Object.prototype.hasOwnProperty.call(n, tagName)).map(n => n[tagName]);
}
function firstChild(node, tagName) {
  const c = children(node, tagName);
  return c.length ? c[0] : null;
}
function textOf(node) {
  // node la mang cac the con cua 1 phan tu <m:r> (chua m:t)
  let out = '';
  for (const rNode of children(node, 'm:r')) {
    for (const tNode of children(rNode, 'm:t')) {
      const raw = Array.isArray(tNode) ? (tNode[0] && tNode[0]['#text']) : tNode;
      out += mapSymbol(typeof raw === 'string' ? raw : (raw != null ? String(raw) : ''));
    }
  }
  // truong hop m:t nam truc tiep (khong qua m:r), phong khi cau truc khac thuong
  for (const tNode of children(node, 'm:t')) {
    const raw = Array.isArray(tNode) ? (tNode[0] && tNode[0]['#text']) : tNode;
    out += mapSymbol(typeof raw === 'string' ? raw : (raw != null ? String(raw) : ''));
  }
  return out;
}

// Chuyen 1 chuoi noi dung toan hoc (mang cac phan tu OMML) thanh MathML <mrow>...</mrow>
function convertSeq(nodes) {
  let out = '';
  for (const n of nodes) {
    out += convertNode(n);
  }
  return out;
}

function convertNode(n) {
  const tag = Object.keys(n).find(k => k !== ':@');
  if (!tag) return '';
  const content = n[tag];

  if (tag === 'm:r') {
    const t = textOf([n]);
    return t ? `<mi>${esc(t)}</mi>` : '';
  }
  if (tag === 'm:f') { // phan so
    const num = firstChild(content, 'm:num');
    const den = firstChild(content, 'm:den');
    return `<mfrac><mrow>${num ? convertSeq(num) : ''}</mrow><mrow>${den ? convertSeq(den) : ''}</mrow></mfrac>`;
  }
  if (tag === 'm:sSup') { // luy thua / so mu
    const base = firstChild(content, 'm:e');
    const sup = firstChild(content, 'm:sup');
    return `<msup><mrow>${base ? convertSeq(base) : ''}</mrow><mrow>${sup ? convertSeq(sup) : ''}</mrow></msup>`;
  }
  if (tag === 'm:sSub') { // chi so duoi
    const base = firstChild(content, 'm:e');
    const sub = firstChild(content, 'm:sub');
    return `<msub><mrow>${base ? convertSeq(base) : ''}</mrow><mrow>${sub ? convertSeq(sub) : ''}</mrow></msub>`;
  }
  if (tag === 'm:sSubSup') {
    const base = firstChild(content, 'm:e');
    const sub = firstChild(content, 'm:sub');
    const sup = firstChild(content, 'm:sup');
    return `<msubsup><mrow>${base ? convertSeq(base) : ''}</mrow><mrow>${sub ? convertSeq(sub) : ''}</mrow><mrow>${sup ? convertSeq(sup) : ''}</mrow></msubsup>`;
  }
  if (tag === 'm:rad') { // can bac 2 / can bac n
    const deg = firstChild(content, 'm:deg');
    const e = firstChild(content, 'm:e');
    const inner = e ? convertSeq(e) : '';
    if (deg && deg.length) return `<mroot><mrow>${inner}</mrow><mrow>${convertSeq(deg)}</mrow></mroot>`;
    return `<msqrt><mrow>${inner}</mrow></msqrt>`;
  }
  if (tag === 'm:d') { // dau ngoac ()
    const e = firstChild(content, 'm:e');
    return `<mrow><mo>(</mo>${e ? convertSeq(e) : ''}<mo>)</mo></mrow>`;
  }
  if (tag === 'm:nary') { // tong (sigma), tich phan, tich (pi)...
    const naryPr = firstChild(content, 'm:naryPr');
    let chrValue = '∑';
    if (naryPr) {
      const chr = firstChild(naryPr, 'm:chr');
      if (chr && chr[0] && chr[0][':@'] && chr[0][':@']['@_m:val']) chrValue = chr[0][':@']['@_m:val'];
    }
    const sub = firstChild(content, 'm:sub');
    const sup = firstChild(content, 'm:sup');
    const e = firstChild(content, 'm:e');
    return `<mrow><msubsup><mo>${esc(chrValue)}</mo><mrow>${sub ? convertSeq(sub) : ''}</mrow><mrow>${sup ? convertSeq(sup) : ''}</mrow></msubsup>${e ? convertSeq(e) : ''}</mrow>`;
  }
  if (tag === 'm:func') { // ham so (sin, cos, log...)
    const fName = firstChild(content, 'm:fName');
    const e = firstChild(content, 'm:e');
    return `<mrow>${fName ? convertSeq(fName) : ''}${e ? convertSeq(e) : ''}</mrow>`;
  }
  if (tag === 'm:limLow') { // lim voi bien chay ben duoi
    const e = firstChild(content, 'm:e');
    const lim = firstChild(content, 'm:lim');
    return `<munder><mrow>${e ? convertSeq(e) : ''}</mrow><mrow>${lim ? convertSeq(lim) : ''}</mrow></munder>`;
  }
  if (tag === 'm:e' || tag === 'm:oMath' || tag === 'm:oMathPara') {
    return convertSeq(content);
  }
  // Cac phan tu chua ro/hiem gap: co gang duyet sau vao trong de khong mat noi dung
  if (Array.isArray(content)) return convertSeq(content);
  return '';
}

// Nhan mang cac phan tu con truc tiep cua 1 the <m:oMath> (dang preserveOrder cua fast-xml-parser)
function ommlNodeToMathml(oMathChildren) {
  try {
    const inner = convertSeq(oMathChildren);
    return `<math xmlns="http://www.w3.org/1998/Math/MathML">${inner}</math>`;
  } catch (e) {
    return null; // that bai thi bo qua, khong lam vo ca file
  }
}

module.exports = { ommlNodeToMathml };
