const crypto = require("crypto");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { paymentKey, orderId, amount, phone, kit } = req.body;

  // 1) 토스 결제 승인
  const secretKey = process.env.TOSS_SECRET_KEY;
  const basicToken = Buffer.from(secretKey + ":").toString("base64");

  try {
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      return res.status(400).json({
        success: false,
        message: tossData.message || "결제 승인 실패",
      });
    }

    // 2) 결제 성공 → 비밀번호 문자 발송
    const bagPassword = process.env.BAG_PASSWORD || "1234";
    const kitCode = kit || "UNKNOWN";

    const smsText =
      `[작업실 SEOUL] 결제가 완료되었습니다.\n` +
      `#${kitCode}\n` +
      `비밀번호 : ${bagPassword}\n` +
      `반납 시 반드시 원상태로 잠근 후 매대에 놓아주시기 바랍니다.`;

    // 솔라피 API 호출
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const senderPhone = process.env.SENDER_PHONE;

    const date = new Date().toISOString();
    const salt = crypto.randomBytes(32).toString("hex");
    const hmac = crypto.createHmac("sha256", apiSecret);
    hmac.update(date + salt);
    const signature = hmac.digest("hex");

    const smsRes = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({
        message: {
          to: phone,
          from: senderPhone,
          text: smsText,
        },
      }),
    });

    const smsData = await smsRes.json();

    return res.status(200).json({
      success: true,
      password: bagPassword,
      kit: kitCode,
      sms: smsData,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "서버 오류",
    });
  }
};
