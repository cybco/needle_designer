const fs = require('fs');
const path = require('path');

// Read thread files
const dmcContent = fs.readFileSync(path.join(__dirname, '../src/data/dmcThreads.ts'), 'utf8');
const anchorContent = fs.readFileSync(path.join(__dirname, '../src/data/anchorThreads.ts'), 'utf8');
const kreinikContent = fs.readFileSync(path.join(__dirname, '../src/data/kreinikThreads.ts'), 'utf8');

// Extract thread data using regex
const threadRegex = /\{\s*code:\s*'([^']+)',\s*name:\s*'([^']+)',\s*rgb:\s*\[(\d+),\s*(\d+),\s*(\d+)\]/g;

function extractThreads(content) {
  const threads = [];
  let match;
  const regex = new RegExp(threadRegex.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    threads.push({
      code: match[1],
      name: match[2],
      rgb: [parseInt(match[3]), parseInt(match[4]), parseInt(match[5])]
    });
  }
  return threads;
}

function escapeRustString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function generateRustFile(threads, brand, filename) {
  let rustCode = `// ${brand} Thread Library - Auto-generated\n`;
  rustCode += '// DO NOT EDIT - Generated from TypeScript sources\n\n';
  rustCode += 'use super::{ThreadColor, ThreadBrand};\n\n';
  rustCode += `pub fn get_${brand.toLowerCase()}_threads() -> Vec<ThreadColor> {\n`;
  rustCode += '    vec![\n';

  for (const t of threads) {
    const escapedName = escapeRustString(t.name);
    rustCode += '        ThreadColor {\n';
    rustCode += `            code: "${t.code}".to_string(),\n`;
    rustCode += `            name: "${escapedName}".to_string(),\n`;
    rustCode += `            rgb: [${t.rgb.join(', ')}],\n`;
    rustCode += `            brand: ThreadBrand::${brand},\n`;
    rustCode += '            category: None,\n';
    rustCode += '        },\n';
  }

  rustCode += '    ]\n';
  rustCode += '}\n';

  const outPath = path.join(__dirname, '../src-tauri/src/threads', filename);
  fs.writeFileSync(outPath, rustCode);
  console.log(`Written ${threads.length} ${brand} threads to ${filename}`);
}

// Process each brand
const dmcThreads = extractThreads(dmcContent);
const anchorThreads = extractThreads(anchorContent);
const kreinikThreads = extractThreads(kreinikContent);

generateRustFile(dmcThreads, 'DMC', 'dmc.rs');
generateRustFile(anchorThreads, 'Anchor', 'anchor.rs');
generateRustFile(kreinikThreads, 'Kreinik', 'kreinik.rs');

console.log('\nTotal threads:', dmcThreads.length + anchorThreads.length + kreinikThreads.length);
