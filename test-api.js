fetch('http://localhost:3000/api/wp/products/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 1,
    name: 'Test',
    sku: '123',
    recipe: [],
    supplier: 'Test',
    updateLocalOnly: true
  })
}).then(res => res.json()).then(console.log).catch(console.error);
