async function testLocalhostAuth() {
  const url = 'http://localhost:3000/api/auth?shop=eshan-inventory-solutions.myshopify.com';
  console.log('Testing auth on localhost:3000:', url);
  const res = await fetch(url, { redirect: 'manual' });
  console.log('Status:', res.status);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));
  const text = await res.text();
  console.log('Body:', text);
}

testLocalhostAuth().catch(console.error);
