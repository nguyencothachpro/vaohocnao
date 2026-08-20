// Doc file .docx theo dung thu tu trong tai lieu (van ban + cong thuc Equation + anh nhung)
// de ghep dung vi tri cong thuc/anh vao giua cau chu, thay vi de mammoth bo qua cong thuc.
// Neu buoc nao that bai, nem loi ra ngoai de ham goi dung phuong an du phong (mammoth text thuong).
const fs = require('fs');

async function extractDocxRich(filePath) {
  const JSZip = require('jszip');
  const { XMLParser } = require('fast-xml-parser');
  const { ommlNodeToMathml } = require('./ommlToMathml');

  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);

  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Không đọc được cấu trúc file docx');
  const documentXml = await docFile.async('string');

  // Doc bang anh xa quan he (rId -> duong dan file anh trong word/media/...)
  const relMap = {};
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    const relParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const relsDoc = relParser.parse(relsXml);
    const relsRoot = relsDoc.Relationships;
    if (relsRoot && relsRoot.Relationship) {
      const arr = Array.isArray(relsRoot.Relationship) ? relsRoot.Relationship : [relsRoot.Relationship];
      arr.forEach(r => { if (r['@_Id'] && r['@_Target']) relMap[r['@_Id']] = r['@_Target']; });
    }
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: false });
  const parsedDoc = parser.parse(documentXml);

  const images = [];
  let text = '';

  // Tim thuoc tinh trong node preserveOrder: node dang [{ tag: [...], ':@': {attrs} }]
  function getAttr(nodeArr, tag, attrName) {
    if (!Array.isArray(nodeArr)) return null;
    for (const item of nodeArr) {
      if (item[tag] && item[':@']) {
        const val = item[':@'][attrName];
        if (val !== undefined) return val;
      }
    }
    return null;
  }

  // Duyet de tim r:embed (id anh nhung) o bat ky do sau trong 1 nhanh XML
  function findEmbedId(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findEmbedId(item);
        if (found) return found;
      }
      return null;
    }
    if (node && typeof node === 'object') {
      if (node[':@']) {
        const attrs = node[':@'];
        for (const key of Object.keys(attrs)) {
          if (key.endsWith(':embed') || key === '@_r:embed') return attrs[key];
        }
      }
      for (const key of Object.keys(node)) {
        if (key === ':@') continue;
        const found = findEmbedId(node[key]);
        if (found) return found;
      }
    }
    return null;
  }

  async function addImageFromEmbedId(embedId) {
    let target = relMap[embedId];
    if (!target) return;
    if (!target.startsWith('media/')) target = 'media/' + target.split('/').pop();
    const imgPath = 'word/' + target;
    const imgFile = zip.file(imgPath);
    if (!imgFile) return;
    const b64 = await imgFile.async('base64');
    const extMatch = target.match(/\.(\w+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'emf' || ext === 'wmf' ? 'image/png' : 'image/png';
    if (ext === 'emf' || ext === 'wmf') return; // dinh dang vector cu cua Windows, trinh duyet khong hien duoc, bo qua
    const idx = images.length;
    images.push(`data:${mime};base64,${b64}`);
    text += `[[IMG:${idx}]]`;
  }

  // Duyet toan bo cay theo dung thu tu tai lieu: gap w:t -> ghi chu, gap m:oMath -> chen cong thuc,
  // gap w:drawing -> chen anh, cac the khac duyet sau vao ben trong theo dung thu tu
  async function walk(nodeArr) {
    if (!Array.isArray(nodeArr)) return;
    for (const node of nodeArr) {
      const tag = Object.keys(node).find(k => k !== ':@');
      if (!tag) continue;
      const content = node[tag];

      if (tag === 'w:t') {
        const raw = Array.isArray(content) && content[0] ? content[0]['#text'] : content;
        text += (typeof raw === 'string' ? raw : (raw != null ? String(raw) : ''));
      } else if (tag === 'm:oMath' || tag === 'm:oMathPara') {
        const mathml = ommlNodeToMathml(content);
        if (mathml) text += `[[MATH:${encodeURIComponent(mathml)}]]`;
      } else if (tag === 'w:drawing' || tag === 'w:pict') {
        const embedId = findEmbedId(content);
        if (embedId) await addImageFromEmbedId(embedId);
      } else if (tag === 'w:p') {
        await walk(content);
        text += '\n\n';
      } else if (tag === 'w:tab') {
        text += '\t';
      } else if (tag === 'w:br') {
        text += '\n';
      } else if (Array.isArray(content)) {
        await walk(content);
      }
    }
  }

  // Tim toi w:body roi duyet tu do
  async function findBodyAndWalk(node) {
    if (Array.isArray(node)) {
      for (const item of node) await findBodyAndWalk(item);
      return;
    }
    if (node && typeof node === 'object') {
      if (node['w:body']) { await walk(node['w:body']); return; }
      for (const key of Object.keys(node)) {
        if (key === ':@') continue;
        await findBodyAndWalk(node[key]);
      }
    }
  }
  await findBodyAndWalk(parsedDoc);

  // Chuyen token [[MATH:encodedMathml]] thanh the <math> that su (giu nguyen [[IMG:n]] de ham goi ngoai tu xu ly)
  text = text.replace(/\[\[MATH:([^\]]+)\]\]/g, (m, encoded) => {
    try { return decodeURIComponent(encoded); } catch (e) { return ''; }
  });

  return { text, images };
}

module.exports = { extractDocxRich };
