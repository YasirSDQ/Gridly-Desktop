async function test() {
  const url = `http://127.0.0.1:3000/api/rc/sync/copy`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ srcFs: 'local:/', dstFs: 'local:/', _async: true })
  });
  console.log(await res.text());
}
test();
