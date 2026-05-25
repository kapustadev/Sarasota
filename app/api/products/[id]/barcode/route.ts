import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Calculates the UPC-A check digit for an 11-digit string.
 * The 12th digit is the check digit.
 */
function calcUpcCheckDigit(digits11: string): string {
  let odd = 0, even = 0;
  for (let i = 0; i < 11; i++) {
    const d = parseInt(digits11[i]);
    if (i % 2 === 0) odd += d;   // positions 1,3,5,7,9,11 (0-indexed: 0,2,4,6,8,10)
    else even += d;
  }
  const total = odd * 3 + even;
  const check = (10 - (total % 10)) % 10;
  return check.toString();
}

/**
 * Generates a valid 12-digit UPC-A barcode.
 * Format: 0XXXXXXXXXC where X = 10 random digits, C = check digit.
 */
function generateUpcA(): string {
  // Start with '0' (standard UPC-A manufacturer prefix range)
  const base = '0' + Math.floor(1000000000 + Math.random() * 9000000000).toString();
  const check = calcUpcCheckDigit(base); // base is 11 digits
  return base + check;
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;
    
    let barcode = '';
    
    // Parse body if it exists to check if custom barcode was provided
    try {
      const body = await req.json();
      if (body && body.barcode !== undefined) {
        barcode = String(body.barcode).trim();
      }
    } catch (e) {
      // Body might be empty or invalid json, ignore
    }

    if (barcode) {
      // Validate UPC-A: must be exactly 12 digits
      if (!/^\d{12}$/.test(barcode)) {
        return NextResponse.json(
          { error: 'Штрих-код должен содержать ровно 12 цифр (формат UPC-A)' },
          { status: 400 }
        );
      }

      // Validate that it doesn't already exist on another product
      const existing = await prisma.product.findFirst({
        where: { barcode, NOT: { id } }
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Этот штрих-код уже используется для другого товара' },
          { status: 400 }
        );
      }
    } else {
      // Auto-generate a valid UPC-A (12-digit) barcode
      let candidate = generateUpcA();
      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const conflict = await prisma.product.findFirst({ where: { barcode: candidate } });
        if (!conflict) break;
        candidate = generateUpcA();
        attempts++;
      }
      barcode = candidate;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { barcode }
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
