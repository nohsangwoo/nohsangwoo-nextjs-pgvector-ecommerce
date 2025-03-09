import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'

// Stealth 플러그인 사용
puppeteer.use(StealthPlugin())

// 상품 데이터 타입 정의
interface Product {
  name: string
  description: string
  price: number
  stock: number
  images: string[]
}

// 랜덤 딜레이 함수 (밀리초 단위)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function scrapeGoogleShopping(
  query: string,
  maxResults: number,
): Promise<void> {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  // 일반 브라우저와 유사한 User-Agent 설정
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/115.0.0.0 Safari/537.36',
  )

  // 구글 쇼핑 검색 URL로 이동
  const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(
    query,
  )}`
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' })

  // 상품 리스트 요소가 나타날 때까지 대기 (타임아웃 발생 시 catch)
  try {
    await page.waitForSelector('.sh-dgr__content', { timeout: 10000 })
  } catch (error) {
    console.error(
      '❌ 상품 요소를 찾을 수 없습니다. 페이지 구조 변경 또는 네트워크 문제일 수 있습니다.',
    )
    await browser.close()
    return
  }

  // 페이지 스크롤: 추가 상품 로딩
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      let totalHeight = 0
      const distance = 500
      const timer = setInterval(() => {
        window.scrollBy(0, distance)
        totalHeight += distance
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 300)
    })
  })

  // 페이지 내 상품 요소 핸들 가져오기
  const productElements = await page.$$('.sh-dgr__content')
  console.log(`총 ${productElements.length}개의 상품 요소를 찾았습니다.`)

  const products: Product[] = []
  let count = 0

  // 각 상품 처리 (진행 상황 실시간 업데이트)
  for (const element of productElements) {
    if (count >= maxResults) break

    // 각 아이템 파싱 전에 랜덤 딜레이 적용 (500~1500ms)
    await delay(Math.floor(Math.random() * 1000) + 500)

    const product: Product = await page.evaluate(el => {
      const name = el.querySelector('.tAxDx')?.textContent?.trim() || 'No Name'
      const description =
        el.querySelector('.aULzUe')?.textContent?.trim() || 'No Description'
      const priceText =
        el.querySelector('.a8Pemb')?.textContent?.replace(/[^\d.]/g, '') || '0'
      const price = parseFloat(priceText)
      // 이미지 필터링: 실제 URL만 저장 (base64 placeholder 제거)
      const images = Array.from(el.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => src.startsWith('http'))
        .slice(0, 3)

      return {
        name,
        description,
        price,
        stock: 60, // 고정값
        images,
      }
    }, element)

    products.push(product)
    count++
    process.stdout.write(`Processed ${count} / ${maxResults} items.\r`)
  }

  // 진행 완료 후 개행
  console.log('\n')

  await browser.close()

  if (products.length === 0) {
    console.error(
      '❌ 크롤링된 상품이 없습니다. 키워드를 확인하거나 페이지 구조 변경 여부를 점검하세요.',
    )
    return
  }

  // JSON 파일로 저장
  const filePath = `${query}_products.json`
  fs.writeFileSync(filePath, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`✅ ${filePath} 파일 저장 완료! (총 ${products.length}개)`)
}

// 실행 (검색어와 크롤링 개수를 인자로 받음)
// 예: npx tsx googleShoppingScraper.ts "애기신발" 10
const searchKeyword: string = process.argv[2] || '의류' // 기본값: 의류
const maxItems: number = parseInt(process.argv[3]) || 10 // 기본값: 10개
scrapeGoogleShopping(searchKeyword, maxItems)
