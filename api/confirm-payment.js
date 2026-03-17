// api/confirm-payment.js
// 토스 결제 확인 + 비번 문자 발송

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { paymentKey, orderId, amount, phone } = req.body;

  const TOSS_SECRET = process.env.TOSS_SECRET_KEY;
  const SOLAPI_KEY = process.env.SOLAPI_API_KEY;
  const SOLAPI_SECRET = process.env.SOLAPI_API_SECRET;
  const SENDER_PHONE = process.env.SENDER_PHONE;
  const PASSWORD = process.env.BAG_PASSWORD || "1234"; // 007가방 비번

  // 1. 토스 결제 승인
  try {
    const confirmRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(TOSS_SECRET + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const payData = await confirmRes.json();

    if (payData.code) {
      return res.status(400).json({ success: false, message: payData.message });
    }

    // 2. 비번 문자 발송
    try {
      const crypto = await import("crypto");
      const date = new Date().toISOString();
      const salt = Math.random().toString(36).substring(2);
      const signature = crypto.default
        .createHmac("sha256", SOLAPI_SECRET)
        .update(date + salt)
        .digest("hex");

      await fetch("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `HMAC-SHA256 apiKey=${SOLAPI_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
        },
        body: JSON.stringify({
          message: {
            to: phone,
            from: SENDER_PHONE,
            text: `[작업실 SEOUL] 렌탈 결제가 완료됐습니다.\n\n007가방 비밀번호: ${PASSWORD}\n\n반납 시 가방에 넣고 잠근 후 매대에 놓아주세요.`,
          },
        }),
      });
    } catch (smsErr) {
      console.error("비번 문자 발송 실패:", smsErr);
      // 문자 실패해도 결제는 성공 처리
    }

    return res.status(200).json({ success: true, password: PASSWORD });

  } catch (e) {
    console.error("결제 확인 실패:", e);
    return res.status(500).json({ success: false, message: "결제 확인 실패" });
  }
}
