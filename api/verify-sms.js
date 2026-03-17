// api/verify-sms.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { phone, code } = req.body;

  const stored = await redis.get(`sms:${phone}`);

  if (!stored) {
    return res.status(400).json({ success: false, message: "인증번호가 만료됐습니다." });
  }

  if (stored !== code) {
    return res.status(400).json({ success: false, message: "인증번호가 올바르지 않습니다." });
  }

  // 인증 성공 후 삭제
  await redis.del(`sms:${phone}`);

  return res.status(200).json({ success: true });
}
