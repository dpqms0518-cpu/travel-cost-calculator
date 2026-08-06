# 축산환경관리원 출장비 계산기 — TMAP 연동판

카카오 대신 **TMAP(SK Open API)** 을 서버(백엔드) 경유로 호출하도록 바꾼 버전입니다.

## 왜 서버가 필요한가요?

TMAP도 카카오와 마찬가지로 REST API 키를 브라우저에 그대로 노출하면 안 되고,
`appKey` 헤더를 붙여 호출해야 합니다. 브라우저에서 `apis.openapi.sk.com`을 직접
호출하면 CORS 문제와 키 노출 문제가 동시에 생기므로, 이 프로젝트는 다음과 같은
아주 얇은 서버 프록시 2개를 둡니다.

- `api/tmap-geocode.js` — 장소명 → 좌표(x, y) 변환
- `api/tmap-route.js` — 출발지/도착지(+경유지) 좌표 → 거리(km), 통행료

브라우저(`index.html`)는 이 두 엔드포인트만 호출하고, TMAP `appKey`는 서버 환경변수에만
존재합니다.

## 배포 방법 (Vercel 기준, 무료로 가능)

1. [TMAP Open API 발급](https://openapi.sk.com) 에서 `appKey`를 발급받습니다.
2. 이 폴더(`index.html`, `api/` 포함) 전체를 GitHub 저장소에 올립니다.
3. [Vercel](https://vercel.com)에서 해당 저장소를 Import 합니다.
   - Framework Preset: **Other** (정적 파일 + 서버리스 함수 조합이라 별도 프레임워크 불필요)
4. Vercel 프로젝트 설정 > **Environment Variables** 에 다음을 추가합니다.
   - `TMAP_APP_KEY` = 발급받은 appKey
5. Deploy 후, 배포된 도메인으로 접속하면 `index.html`이 뜨고
   `/api/tmap-geocode`, `/api/tmap-route` 가 자동으로 함께 배포됩니다.

Vercel이 아니어도 Netlify Functions, Cloudflare Workers, 자체 Node.js/Express
서버 등 어디에 올려도 원리는 같습니다 (요청을 받아서 TMAP을 대신 호출하고 결과만
JSON으로 돌려주는 얇은 함수 하나).

## 확인이 필요한 부분

- `api/tmap-route.js`의 통행료(toll) 필드명(`totalFare`)은 TMAP 응답 옵션에 따라
  다르게 나올 수 있습니다. 배포 후 실제 응답을 한 번 콘솔에 찍어(`console.log(data)`)
  정확한 필드명을 확인한 뒤 필요하면 맞춰서 수정해 주세요.
- 유가(오피넷) 조회는 기존과 동일하게 `allorigins.win` 프록시를 그대로 쓰고 있습니다.
  이 부분도 안정성을 높이려면 같은 방식(서버 프록시)으로 옮기는 것을 권장합니다.
