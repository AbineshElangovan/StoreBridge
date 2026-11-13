async function checkAmplifyAuth() {
  const url = 'https://version-control.d38r9lc5j1o8oj.amplifyapp.com/api/auth?shop=eshan-inventory-solutions.myshopify.com';
  console.log('Fetching:', url);
  const res = await fetch(url, { redirect: 'manual' });
  console.log('Status:', res.status);
  console.log('Headers:', Object.fromEntries(res.headers.entries()));
  const text = await res.text();
  console.log('Body:', text.slice(0, 500));
}

checkAmplifyAuth().catch(console.error);
