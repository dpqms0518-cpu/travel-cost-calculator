// api/tmap-geocode.js
// 역할: 프론트엔드에서 장소명(키워드)을 보내면, 서버가 대신 TMAP POI 검색 API를 호출해서
//       좌표(x=경도, y=위도)만 돌려준다. TMAP appKey는 여기(서버)에서만 사용되고
//       브라우저로 절대 노출되지 않는다.
//
// 배포 환경(Vercel 기준) 준비물:
//   1) Vercel 프로젝트 설정 > Environment Variables 에 TMAP_APP_KEY 등록
//   2) 이 파일을 프로젝트 루트의 /api 폴더에 그대로 두면 자동으로
//      https://내도메인/api/tmap-geocode 로 배포됨
//
// 프론트엔드 호출 예:
//   fetch(`/api/tmap-geocode?q=${encodeURIComponent('세종특별자치시 한누리대로 219')}`)

module.exports = async function handler(req, res) {
  // CORS: 같은 사이트에서만 부르는 게 기본이지만, 필요시 도메인 제한 가능
  res.setHeader('Access-Control-Allow-Origin', '*');

  const keyword = (req.query.q || '').toString().trim();
  if (!keyword) {
    return res.status(400).json({ ok: false, error: 'q(검색어) 파라미터가 필요합니다.' });
  }

  const appKey = process.env.TMAP_APP_KEY;
  if (!appKey) {
    return res.status(500).json({ ok: false, error: '서버에 TMAP_APP_KEY 환경변수가 설정되어 있지 않습니다.' });
  }

  const url = `https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodeURIComponent(
    keyword
  )}&searchType=all&page=1&count=5&resCoordType=WGS84GEO&reqCoordType=WGS84GEO&multiPoint=N&poiGroupYn=N`;

  try {
    const tmapRes = await fetch(url, {
      headers: {
        Accept: 'application/json',
        appKey,
      },
    });

    if (!tmapRes.ok) {
      const text = await tmapRes.text();
      return res.status(502).json({ ok: false, error: 'TMAP 응답 실패', detail: text });
    }

    const data = await tmapRes.json();

    // TMAP 응답은 검색 결과가 1건이면 객체, 여러 건이면 배열로 오는 경우가 있어
    // 두 케이스를 모두 처리한다.
    const rawPoi = data?.searchPoiInfo?.pois?.poi;
    const poi = Array.isArray(rawPoi) ? rawPoi[0] : rawPoi;

    if (!poi) {
      return res.status(404).json({ ok: false, error: `"${keyword}"에 대한 검색 결과가 없습니다.` });
    }

    // noorLat/noorLon: POI 자체 좌표(정문 등 실제 출입 지점 좌표), WGS84 기준
    const y = parseFloat(poi.noorLat ?? poi.frontLat);
    const x = parseFloat(poi.noorLon ?? poi.frontLon);

    if (!isFinite(x) || !isFinite(y)) {
      return res.status(502).json({ ok: false, error: 'TMAP 응답에서 좌표를 파싱하지 못했습니다.', raw: poi });
    }

    // 주소 조합 (시/도 + 시/군/구 + 읍/면/동 + 도로명 + 건물번호). 필드가 없으면 빈 값은 자동으로 제외됨.
    const addressParts = [poi.upperAddrName, poi.middleAddrName, poi.lowerAddrName, poi.roadName, poi.firstNo]
      .filter((v) => v && String(v).trim() !== '' && v !== '0');
    const address = addressParts.join(' ');

    return res.status(200).json({ ok: true, name: poi.name, address, x, y });
  } catch (err) {
    return res.status(500).json({ ok: false, error: '서버 내부 오류', detail: String(err) });
  }
}
