// api/verify-sms.js
// 인증번호 확인

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { phone, code } = req.body;

  global.smsCodes = global.smsCodes || {};
  const stored = global.smsCodes[phone];

  if (!stored) {
    return res.status(400).json({ success: false, message: "인증번호를 먼저 요청해주세요." });
  }

  if (Date.now() > stored.expiry) {
    delete global.smsCodes[phone];
    return res.status(400).json({ success: false, message: "인증번호가 만료됐습니다." });
  }

  if (stored.code !== code) {
    return res.status(400).json({ success: false, message: "인증번호가 올바르지 않습니다." });
  }

  // 인증 성공 후 삭제
  delete global.smsCodes[phone];

  return res.status(200).json({ success: true });
}
