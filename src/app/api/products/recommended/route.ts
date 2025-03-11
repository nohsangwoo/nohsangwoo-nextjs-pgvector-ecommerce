import { NextResponse } from "next/server"
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import pgvector from 'pgvector'
import pool from '@/lib/pgClient'

const prisma = new PrismaClient()
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const CDN_URL = "https://cdn.yes.monster/"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const excludeId = searchParams.get("exclude")
  
  if (!excludeId) {
    return NextResponse.json({ error: "상품 ID가 필요합니다" }, { status: 400 })
  }

  try {
    // 현재 상품 정보 가져오기
    const product = await prisma.product.findUnique({
      where: {
        id: parseInt(excludeId),
      },
    })

    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 })
    }

    // 상품명 임베딩 생성
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: product.name,
      encoding_format: 'float',
    })
    const embeddings = embedding.data[0].embedding
    const postEmb = pgvector.toSql(embeddings)

    // 유사한 상품 검색 쿼리 (이미지 포함)
    const similarProducts = await pool.query(`
      WITH similar_products AS (
        SELECT 
          p.id, 
          p.name, 
          p.price,
          p.category,
          1 - (p.vector <=> $1) as similarity
        FROM "Product" p
        WHERE p.id <> $2
        ORDER BY similarity DESC
        LIMIT 10
      )
      SELECT sp.id, sp.name, sp.price, sp.category 
      FROM similar_products sp
      ORDER BY (similarity * 0.9) + (RANDOM() * 0.1) DESC
      LIMIT 4
    `, [postEmb, parseInt(excludeId)])
    
    // 이미지 정보 가져오기
    const productIds = similarProducts.rows.map(p => p.id)
    
    const productsWithImages = await prisma.product.findMany({
      where: {
        id: {
          in: productIds
        }
      },
      include: {
        images: {
          take: 1 // 첫 번째 이미지만 가져오기
        }
      }
    })
    
    // 최종 결과 생성
    const result = similarProducts.rows.map(product => {
      const productWithImage = productsWithImages.find(p => p.id === product.id)
      const imageSrc = productWithImage?.images?.[0]?.original 
        ? `${CDN_URL}${productWithImage.images[0].original}` 
        : "/placeholder.svg"
      
      return {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        imageSrc: imageSrc
      }
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("추천 상품 조회 오류:", error)
    return NextResponse.json({ error: "추천 상품을 가져오는데 실패했습니다" }, { status: 500 })
  }
}

