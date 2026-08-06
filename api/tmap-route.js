// api/tmap-route.js
// 역할: 프론트엔드에서 출발/도착(+경유지) 좌표를 보내면, 서버가 대신 TMAP 자동차 경로 API를
//       호출해서 총 거리(m)와 통행료 추정치를 돌려준다.
//
// 프론트엔드 호출 예 (POST):
//   fetch('/api/tmap-route', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       startX, startY, endX, endY,
//       waypoints: [{x: 127.xxx, y: 37.xxx}, ...] // 선택
//     })
//   })

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST 요청만 지원합니다.' });
  }

  const appKey = process.env.TMAP_APP_KEY;
  if (!appKey) {
    return res.status(500).json({ ok: false, error: '서버에 TMAP_APP_KEY 환경변수가 설정되어 있지 않습니다.' });
  }

  const { startX, startY, endX, endY, waypoints } = req.body || {};

  if ([startX, startY, endX, endY].some((v) => v === undefined || v === null || v === '')) {
    return res.status(400).json({ ok: false, error: 'startX, startY, endX, endY는 필수입니다.' });
  }

  const body = {
    startX: String(startX),
    startY: String(startY),
    endX: String(endX),
    endY: String(endY),
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    searchOption: '0', // 0: 추천(가장 일반적인) 경로
    trafficInfo: 'Y', // 실시간 교통정보 반영
  };

  // 경유지가 있으면 "x,y_x,y" 형식으로 이어붙임 (TMAP 규격)
  if (Array.isArray(waypoints) && waypoints.length > 0) {
    body.passList = waypoints.map((w) => `${w.x},${w.y}`).join('_');
  }

  try {
    const tmapRes = await fetch('https://apis.openapi.sk.com/tmap/routes?version=1', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        appKey,
      },
      body: JSON.stringify(body),
    });

    if (!tmapRes.ok) {
      const text = await tmapRes.text();
      return res.status(502).json({ ok: false, error: 'TMAP 경로 API 응답 실패', detail: text });
    }

    const data = await tmapRes.json();

    // 경로 요약 정보는 보통 features[0].properties 에 들어있음
    const summaryProps = data?.features?.[0]?.properties;

    if (!summaryProps) {
      return res.status(502).json({ ok: false, error: 'TMAP 응답에서 경로 요약 정보를 찾지 못했습니다.', raw: data });
    }

    const distanceM = Number(summaryProps.totalDistance ?? 0);
    const durationSec = Number(summaryProps.totalTime ?? 0);

    // 주의: 통행료 필드명은 TMAP 버전/요청옵션에 따라 totalFare / taxiFare 등으로
    // 표기가 달라질 수 있습니다. 실제 응답을 콘솔에 찍어서 정확한 필드명을
    // 한 번 확인한 뒤 아래 라인을 맞춰 쓰는 것을 권장합니다.
    const tollFare = Number(summaryProps.totalFare ?? 0);

    return res.status(200).json({
      ok: true,
      distanceKm: Math.round((distanceM / 1000) * 10) / 10,
      durationSec,
      tollFare,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: '서버 내부 오류', detail: String(err) });
  }
}
