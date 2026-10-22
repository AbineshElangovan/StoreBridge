import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Store logos are configured globally in code.' });
}
