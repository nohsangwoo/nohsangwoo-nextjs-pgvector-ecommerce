import { NextRequest, NextResponse } from 'next/server'
import prismaClient from '@/lib/prismaClient'
import { Category } from '@prisma/client'

interface MockProduct {
  id: number
  title: string
  body: string
}

interface Product {
  id: string
  name: string
  price: number
  description: string
  imageSrc: string
  category: string
  rating: number
  reviews: number
  inStock: boolean
}

const CATEGORIES = ['men', 'women', 'accessories', 'shoes']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const category = searchParams.get('category')
  const limit = searchParams.get('limit')

  try {
    const products = await prismaClient.product.findMany({
      where: {
        category: category as Category,
      },
      take: limit ? parseInt(limit) : undefined,
      include: {
        images: true,
      },
    })

    console.log('products in api/products/route.ts: ', products)
    // const response = await fetch('https://jsonplaceholder.typicode.com/posts')
    // const mockProducts: MockProduct[] = await response.json()

    // const products: Product[] = mockProducts.slice(0, 20).map(mockProduct => ({
    //   id: mockProduct.id.toString(),
    //   name: mockProduct.title.slice(0, 30),
    //   price: Math.floor(Math.random() * 100000) + 10000,
    //   description: mockProduct.body,
    //   imageSrc: `/placeholder.svg?text=Product${mockProduct.id}`,
    //   category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
    //   rating: Math.random() * 2 + 3,
    //   reviews: Math.floor(Math.random() * 500),
    //   inStock: Math.random() > 0.2,
    // }))

    return NextResponse.json(products)
  } catch (error) {
    console.error('Failed to fetch products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 },
    )
  }
}
