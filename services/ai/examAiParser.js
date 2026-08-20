// Dung Claude API (Anthropic) de doc hieu de thi va tra ve dung dinh dang JSON co cau truc.
// Can nguoi dung tu cau hinh API Key rieng cua ho tai Admin > Cai dat AI (console.anthropic.com),
// khong dung chung API key cua he thong -> nguoi dung tu chiu chi phi theo muc su dung thuc te cua ho.
const axios = require('axios');

const SYSTEM_PROMPT = `Bạn là công cụ số hóa đề thi. Nhiệm vụ: đọc văn bản đề thi (có thể lộn xộn do trích xuất từ Word/PDF) và trả về DUY NHẤT một mảng JSON hợp lệ, không kèm giải thích, không dùng markdown code fence.

Mỗi phần tử trong mảng là 1 câu hỏi theo đúng 1 trong 4 dạng sau:
1. Trắc nghiệm 1 đáp án đúng: {"type":"single_choice","question":"...","points":0.25,"options":["...","...","...","..."],"correctIndex":0}
2. Đúng/Sai nhiều ý (thường có 4 ý a,b,c,d): {"type":"true_false","question":"...","points":1,"items":[{"content":"...","is_correct":true},{"content":"...","is_correct":false}]}
3. Trả lời ngắn (đề yêu cầu tự tính/tự điền đáp án cụ thể): {"type":"short_answer","question":"...","points":0.5,"correct_answer":"..."}
4. Tự luận (không có đáp án cụ thể, cần chấm tay - vd Ngữ văn): {"type":"essay","question":"...","points":2}

Quy tắc quan trọng:
- Nếu văn bản có công thức Toán/Lý/Hóa bị lỗi ký tự do không đọc được từ file gốc, hãy cố suy luận lại nội dung hợp lý nhất có thể dựa trên ngữ cảnh, và nếu không chắc chắn, giữ nguyên phần chữ đọc được, không tự bịa số liệu.
- Nếu trong văn bản có các token dạng [[IMG:0]], [[IMG:1]]... (đại diện cho hình ảnh/công thức được nhúng trong file gốc), PHẢI giữ nguyên y hệt các token này ở đúng vị trí trong câu hỏi/phương án tương ứng, không được xóa, đổi số, hay diễn giải nội dung của chúng.
- Nếu tìm thấy đáp án đúng trong đề (ghi rõ hoặc có bảng đáp án), hãy gán correctIndex/is_correct/correct_answer tương ứng. Nếu KHÔNG chắc chắn đáp án đúng, vẫn tạo câu hỏi bình thường nhưng chọn correctIndex là -1 (nghĩa là chưa xác định, để người dùng tự chọn lại).
- Giữ nguyên số thứ tự và nội dung câu hỏi càng sát bản gốc càng tốt.
- Chỉ trả về mảng JSON, không thêm bất kỳ chữ nào khác.`;

async function parseWithAI(examText, config, images = []) {
  const { restoreImages } = require('../examImport/extractText');
  const apiKey = (config.ai_api_key || '').trim();
  if (!apiKey) throw new Error('Chưa cấu hình AI API Key');
  const model = (config.ai_model || 'claude-sonnet-5').trim();

  // Cat bot neu van ban qua dai (tranh vuot gioi han token / chi phi qua cao ngoai y muon)
  const trimmedText = examText.length > 40000 ? examText.slice(0, 40000) : examText;

  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Đây là văn bản đề thi cần số hóa:\n\n${trimmedText}` }]
  }, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    timeout: 60000
  });

  const textBlock = (response.data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('AI không trả về nội dung hợp lệ');

  let jsonStr = textBlock.text.trim();
  // Phong truong hop AI lo boc trong markdown code fence du da can dan
  jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) throw new Error('AI không trả về mảng câu hỏi hợp lệ');

  // Khoi phuc lai anh/cong thuc nhung (tu [[IMG:n]] thanh the <img> that) trong tung cau hoi/phuong an
  return parsed.map(q => {
    const restored = { ...q, needsReview: q.correctIndex === -1 || q.needsReview === true };
    if (restored.question) restored.question = restoreImages(restored.question, images);
    if (Array.isArray(restored.options)) restored.options = restored.options.map(o => restoreImages(o, images));
    if (Array.isArray(restored.items)) restored.items = restored.items.map(it => ({ ...it, content: restoreImages(it.content, images) }));
    return restored;
  });
}

module.exports = { parseWithAI };
