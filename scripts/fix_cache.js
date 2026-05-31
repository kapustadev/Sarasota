const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList);
    } else if (filePath.endsWith('route.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const routes = walk('./app/api');
let fixedCount = 0;

for (const route of routes) {
  let content = fs.readFileSync(route, 'utf8');
  if (content.includes('export async function GET') && !content.includes('force-dynamic')) {
    content = `export const dynamic = 'force-dynamic';\n\n` + content;
    fs.writeFileSync(route, content, 'utf8');
    fixedCount++;
  }
}

console.log(`Fixed ${fixedCount} routes.`);
