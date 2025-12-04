import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import * as cheerio from 'cheerio'

// Initialize Supabase client with service role key for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { productLink, eventId, userId } = await request.json()

    // Validate required fields
    if (!productLink || !eventId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: productLink, eventId, userId' },
        { status: 400 }
      )
    }

    // Validate it's an Amazon URL (supports amazon.com, amzn.to, a.co)
    const isAmazonUrl = productLink.includes('amazon.com') ||
                       productLink.includes('amzn.to') ||
                       productLink.includes('amzn.') ||
                       productLink.includes('a.co/')
    if (!isAmazonUrl) {
      return NextResponse.json(
        { error: 'Only Amazon product links are supported' },
        { status: 400 }
      )
    }

    // Verify the event exists and user is the owner
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, user_id')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    if (event.user_id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You are not the owner of this event' },
        { status: 403 }
      )
    }

    // Scrape Amazon product data
    console.log('Fetching Amazon product page:', productLink)

    // Add random delay to avoid bot detection (200-800ms)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 600 + 200))

    const response = await axios.get(productLink, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Cache-Control': 'max-age=0'
      },
      timeout: 15000, // 15 second timeout
      maxRedirects: 5, // Follow redirects (for a.co links)
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Don't throw on 4xx
      }
    })

    // Log the final URL after redirects
    const finalUrl = response.request?.res?.responseUrl || productLink
    console.log('Final URL after redirects:', finalUrl)
    console.log('Response status:', response.status)

    const html = response.data
    const $ = cheerio.load(html)

    // Debug: Log page structure
    console.log('Page title tag:', $('title').text())
    console.log('Has productTitle element:', $('#productTitle').length > 0)
    console.log('Has price element:', $('.a-price').length > 0)

    // Extract product title (try multiple selectors)
    let title = $('#productTitle').text().trim()
    if (!title) {
      title = $('span#productTitle').text().trim()
    }
    if (!title) {
      title = $('h1.a-size-large.a-spacing-none').first().text().trim()
    }
    if (!title) {
      title = $('h1#title').text().trim()
    }
    if (!title) {
      title = $('[data-feature-name="title"] h1').text().trim()
    }
    if (!title) {
      // Last resort: find any h1 in the main content area
      title = $('#dp h1').first().text().trim()
    }

    // Clean up title (remove extra whitespace, newlines)
    if (title) {
      title = title.replace(/\s+/g, ' ').trim()
    }

    // Extract price (try multiple selectors as Amazon changes them frequently)
    let priceText = ''

    // Try offscreen price first (most reliable)
    priceText = $('.a-price .a-offscreen').first().text().trim()

    // Try whole + fraction price format
    if (!priceText) {
      const priceWhole = $('.a-price-whole').first().text().trim()
      const priceFraction = $('.a-price-fraction').first().text().trim()
      if (priceWhole) {
        priceText = priceWhole + (priceFraction || '00')
      }
    }

    // Try alternate price locations
    if (!priceText) {
      priceText = $('span.a-price span.a-offscreen').first().text().trim()
    }
    if (!priceText) {
      priceText = $('#priceblock_ourprice').text().trim()
    }
    if (!priceText) {
      priceText = $('#priceblock_dealprice').text().trim()
    }
    if (!priceText) {
      priceText = $('#price_inside_buybox').text().trim()
    }
    if (!priceText) {
      priceText = $('.a-price-range .a-price .a-offscreen').first().text().trim()
    }
    if (!priceText) {
      priceText = $('[data-a-color="price"] .a-offscreen').first().text().trim()
    }

    // Parse price to cents
    let priceCents = 0
    if (priceText) {
      // Remove currency symbols and convert to number
      const priceMatch = priceText.match(/[\d,]+\.?\d*/);
      if (priceMatch) {
        const priceNumber = parseFloat(priceMatch[0].replace(/,/g, ''))
        priceCents = Math.round(priceNumber * 100)
      }
    }

    // Extract image URL
    let imageUrl = ''

    // Try main product image
    imageUrl = $('#landingImage').attr('src') ||
               $('#landingImage').attr('data-old-hires') ||
               $('#imgBlkFront').attr('src') ||
               $('.a-dynamic-image').first().attr('src') ||
               $('img[data-a-dynamic-image]').first().attr('src')

    // If we got a small thumbnail, try to get the larger version
    if (imageUrl && imageUrl.includes('._')) {
      // Remove the size constraint (e.g., ._AC_SX300_ becomes just the base URL)
      imageUrl = imageUrl.split('._')[0] + '.jpg'
    }

    console.log('Scraped data:', { title, priceCents, imageUrl })

    // Validate we got at least a title
    if (!title) {
      return NextResponse.json(
        {
          error: 'Could not extract product information from Amazon page. The page structure may have changed or the link may be invalid.',
          details: 'Title not found'
        },
        { status: 422 }
      )
    }

    // Insert item into database
    const { data: newItem, error: insertError } = await supabase
      .from('items')
      .insert({
        event_id: eventId,
        title: title,
        price_cents: priceCents || 0,
        current_amount_cents: 0,
        product_link: productLink,
        image_url: imageUrl || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save item to database', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('Item created successfully:', newItem.id)

    return NextResponse.json({
      success: true,
      item: newItem,
      scraped: {
        title: !!title,
        price: !!priceCents,
        image: !!imageUrl
      }
    })

  } catch (error) {
    console.error('Error in add-from-amazon:', error)

    // Handle specific error types
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: 'Request timeout: Amazon took too long to respond. Please try again.' },
        { status: 504 }
      )
    }

    if (error.response?.status === 503) {
      return NextResponse.json(
        { error: 'Amazon is temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      )
    }

    if (error.response?.status === 404) {
      return NextResponse.json(
        { error: 'Product not found. Please check the Amazon link and try again.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to scrape Amazon product data. Please try adding the item manually.',
        details: error.message
      },
      { status: 500 }
    )
  }
}