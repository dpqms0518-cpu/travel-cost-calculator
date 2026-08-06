// api/opinet-price.js
// 역할: 프론트엔드에서 날짜/유종코드를 보내면, 서버가 대신 오피넷(OPINET) 전국 평균가 API를
//       호출해서 가격(숫자)만 JSON으로 돌려준다.
//       기존 allorigins.win 공용 프록시는 자주 타임아웃(522)이 나서 이 방식으로 교체.
//
// 프론트엔드 호출 예:
//   fetch(`/api/opinet-price?date=20260806&prodcd=B027`)

// 오피넷 API 키. 민감정보는 아니지만, 원하면 Vercel 환경변수(OPINET_KEY)로 옮겨도 됩니다.
const OPINET_KEY = process.env.OPINET_KEY || "F260805687";

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const date = (req.query.date || '').toString().trim();
  const prodcd = (req.query.prodcd || 'B027').toString().trim();

  if (!date) {
    return res.status(400).json({ ok: false, error: 'date 파라미터가 필요합니다. (예: 20260806)' });
  }

  const url = `https://www.opinet.co.kr/api/avgRecentPrice.do?out=xml&code=${OPINET_KEY}&date=${date}&prodcd=${prodcd}`;

  try {
    const opinetRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!opinetRes.ok) {
      const text = await opinetRes.text();
      return res.status(502).json({ ok: false, error: '오피넷 응답 실패', detail: text });
    }

    const xmlText = await opinetRes.text();

    // 서버 환경(Node)에는 DOMParser가 없으므로 간단한 정규식으로 PRICE 값을 추출한다.
    const priceMatch = xmlText.match(/<PRICE>([\d.]+)<\/PRICE>/);

    if (!priceMatch) {
      return res.status(502).json({ ok: false, error: '오피넷 응답에서 가격을 찾지 못했습니다.', raw: xmlText });
    }

    const price = parseFloat(priceMatch[1]);

    return res.status(200).json({ ok: true, price, date, prodcd });
  } catch (err) {
    return res.status(500).json({ ok: false, error: '서버 내부 오류', detail: String(err) });
  }
};
