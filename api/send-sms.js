// api/send-sms.js
// SMS 인증번호 발송

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { phone } = req.body;

  if (!phone || !/^010\d{8}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "올바르지 않은 번호" });
  }

  // 6자리 인증번호 생성
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // 인증번호를 임시 저장 (Vercel KV 또는 메모리)
  // 실제 운영시에는 Vercel KV 사용 권장
  global.smsCodes = global.smsCodes || {};
  global.smsCodes[phone] = {
    code,
    expiry: Date.now() + 3 * 60 * 1000, // 3분
  };

  // 솔라피로 SMS 발송
  try {
    const SOLAPI_KEY = process.env.SOLAPI_API_KEY;
    const SOLAPI_SECRET = process.env.SOLAPI_API_SECRET;
    const SENDER_PHONE = process.env.SENDER_PHONE; // 발신번호

    const date = new Date().toISOString();
    const salt = Math.random().toString(36).substring(2);
    
    const crypto = await import("crypto");
    const signature = crypto.default
      .createHmac("sha256", SOLAPI_SECRET)
      .update(date + salt)
      .digest("hex");

    const response = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${SOLAPI_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({
        message: {
          to: phone,
          from: SENDER_PHONE,
          text: `[작업실 SEOUL] 인증번호는 [${code}]입니다. 3분 내 입력해주세요.`,
        },
      }),
    });

    const data = await response.json();
    if (data.errorCode) throw new Error(data.errorMessage);

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("SMS 발송 실패:", e);
    return res.status(500).json({ success: false, message: "SMS 발송 실패" });
  }
}
