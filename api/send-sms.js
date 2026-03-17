// api/send-sms.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { phone } = req.body;

  if (!phone || !/^010\d{8}$/.test(phone)) {
    return res.status(400).json({ success: false, message: "올바르지 않은 번호" });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Redis에 인증번호 저장 (3분 만료)
  await redis.set(`sms:${phone}`, code, { ex: 180 });

  try {
    const SOLAPI_KEY = process.env.SOLAPI_API_KEY;
    const SOLAPI_SECRET = process.env.SOLAPI_API_SECRET;
    const SENDER_PHONE = process.env.SENDER_PHONE;

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
