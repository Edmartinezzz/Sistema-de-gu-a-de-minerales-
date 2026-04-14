const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'public/js/app.js');
let content = fs.readFileSync(p, 'utf8');

// Convert string back to a byte array by taking the charCode of each character 
// (assuming the corruption was reading UTF-8 bytes as Windows-1252/Latin-1 characters)
const buffer = Buffer.alloc(content.length);
for (let i = 0; i < content.length; i++) {
    buffer[i] = content.charCodeAt(i) & 0xFF;
}

// Now parse the original bytes as UTF-8
const fixedContent = buffer.toString('utf8');

fs.writeFileSync(p, fixedContent, 'utf8');
console.log('Fixed encoding for app.js!');

